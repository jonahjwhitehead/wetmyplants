(function () {
  "use strict";

  const storageKey = "sprout-plants";
  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // Continue to work for this visit if browser storage is unavailable.
      }
    }
  };

  function dateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function dateFromInput(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }

  function seedPlants() {
    return PLANT_SEEDS.map(function (seed) {
      const lastWatered = new Date();
      lastWatered.setDate(lastWatered.getDate() + seed.lastWateredOffset);
      return {
        id: seed.id,
        name: seed.name,
        kind: seed.kind,
        frequency: seed.frequency,
        time: seed.time,
        lastWatered: dateInputValue(lastWatered),
        notifiedFor: ""
      };
    });
  }

  let plants = storage.get(storageKey, null);
  if (!Array.isArray(plants)) {
    plants = seedPlants();
    storage.set(storageKey, plants);
  }
  let remindersEnabled = false;

  const form = document.getElementById("plant-form");
  const list = document.getElementById("plant-list");
  const emptyState = document.getElementById("empty-state");
  const plantCount = document.getElementById("plant-count");
  const dueCount = document.getElementById("due-count");
  const plantTotal = document.getElementById("plant-total");
  const overviewMessage = document.getElementById("overview-message");
  const lastWateredInput = document.getElementById("plant-last-watered");
  const notificationButton = document.getElementById("notification-button");
  const notificationLabel = document.getElementById("notification-label");

  function savePlants() {
    storage.set(storageKey, plants);
  }

  function nextWatering(plant) {
    const date = dateFromInput(plant.lastWatered);
    date.setDate(date.getDate() + Number(plant.frequency));
    const timeParts = plant.time.split(":").map(Number);
    date.setHours(timeParts[0], timeParts[1], 0, 0);
    return date;
  }

  function isSameDay(first, second) {
    return first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate();
  }

  function dueLabel(date, now) {
    const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDifference = Math.round((dueDay - today) / 86400000);
    if (dayDifference < 0) return "Overdue";
    if (dayDifference === 0) return "Today";
    if (dayDifference === 1) return "Tomorrow";
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function timeLabel(date) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function makePlantRow(plant, now) {
    const due = nextWatering(plant);
    const isDue = due <= now;
    const row = document.createElement("article");
    row.className = "plant-row" + (isDue ? " is-due" : "");

    const icon = document.createElement("div");
    icon.className = "plant-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = plant.name.trim().charAt(0).toUpperCase();

    const details = document.createElement("div");
    details.className = "plant-details";
    const name = document.createElement("h3");
    name.textContent = plant.name;
    const kind = document.createElement("p");
    kind.className = "plant-kind";
    kind.textContent = plant.kind || "Houseplant";
    details.append(name, kind);

    const schedule = document.createElement("div");
    schedule.className = "plant-schedule";
    const timing = document.createElement("p");
    timing.className = "due-timing";
    timing.textContent = dueLabel(due, now) + " · " + timeLabel(due);
    const rhythm = document.createElement("p");
    rhythm.className = "watering-rhythm";
    rhythm.textContent = "Every " + plant.frequency + (Number(plant.frequency) === 1 ? " day" : " days");
    schedule.append(timing, rhythm);

    const actions = document.createElement("div");
    actions.className = "plant-actions";
    const wateredButton = document.createElement("button");
    wateredButton.className = "water-button";
    wateredButton.type = "button";
    wateredButton.textContent = "Watered";
    wateredButton.setAttribute("aria-label", "Mark " + plant.name + " as watered today");
    wateredButton.addEventListener("click", function () {
      plant.lastWatered = dateInputValue(new Date());
      plant.notifiedFor = "";
      savePlants();
      renderPlants();
    });

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.title = "Remove " + plant.name;
    removeButton.setAttribute("aria-label", "Remove " + plant.name);
    removeButton.addEventListener("click", function () {
      plants = plants.filter(function (item) { return item.id !== plant.id; });
      savePlants();
      renderPlants();
    });

    actions.append(wateredButton, removeButton);
    row.append(icon, details, schedule, actions);
    return row;
  }

  function renderPlants() {
    const now = new Date();
    const orderedPlants = plants.slice().sort(function (first, second) {
      return nextWatering(first) - nextWatering(second);
    });
    const duePlants = orderedPlants.filter(function (plant) {
      return nextWatering(plant) <= now;
    });

    list.replaceChildren.apply(list, orderedPlants.map(function (plant) {
      return makePlantRow(plant, now);
    }));
    emptyState.hidden = plants.length !== 0;
    plantCount.textContent = String(plants.length).padStart(2, "0");
    dueCount.textContent = String(duePlants.length).padStart(2, "0");
    plantTotal.textContent = plants.length + (plants.length === 1 ? " plant" : " plants");
    overviewMessage.textContent = duePlants.length === 0
      ? "All caught up. Your leaves are in good hands."
      : duePlants.length === 1
        ? duePlants[0].name + " is ready for a drink."
        : "A few plants are ready for a drink.";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(form);
    plants.push({
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
      name: String(formData.get("name")).trim(),
      kind: String(formData.get("kind")).trim(),
      frequency: Number(formData.get("frequency")),
      time: String(formData.get("time")),
      lastWatered: String(formData.get("lastWatered")),
      notifiedFor: ""
    });
    savePlants();
    form.reset();
    document.getElementById("plant-frequency").value = "7";
    document.getElementById("plant-time").value = "09:00";
    lastWateredInput.value = dateInputValue(new Date());
    renderPlants();
    document.getElementById("plant-name").focus();
  });

  function updateReminderButton() {
    notificationButton.setAttribute("aria-pressed", remindersEnabled ? "true" : "false");
    notificationButton.classList.toggle("is-enabled", remindersEnabled);
    notificationLabel.textContent = remindersEnabled ? "Reminders on" : "Reminders off";
    notificationButton.title = remindersEnabled ? "Turn off browser reminders" : "Enable browser reminders";
  }

  notificationButton.addEventListener("click", async function () {
    if (remindersEnabled) {
      remindersEnabled = false;
      updateReminderButton();
      return;
    }
    if (!("Notification" in window)) {
      notificationLabel.textContent = "Notifications unavailable";
      return;
    }
    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      remindersEnabled = permission === "granted";
      updateReminderButton();
      if (!remindersEnabled) notificationLabel.textContent = "Permission not granted";
      checkReminders();
    } catch (error) {
      notificationLabel.textContent = "Notifications unavailable";
    }
  });

  function checkReminders() {
    if (!remindersEnabled || Notification.permission !== "granted") return;
    const now = new Date();
    plants.forEach(function (plant) {
      const due = nextWatering(plant);
      const dueKey = due.toISOString();
      if (due <= now && plant.notifiedFor !== dueKey) {
        new Notification("Time to water " + plant.name, {
          body: "Your plant is due for water. It is on your Sprout list."
        });
        plant.notifiedFor = dueKey;
        savePlants();
      }
    });
  }

  document.getElementById("today-label").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  lastWateredInput.value = dateInputValue(new Date());
  updateReminderButton();
  renderPlants();
  window.setInterval(checkReminders, 60000);
})();
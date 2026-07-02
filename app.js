const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const JS_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_LABELS = {
  Monday: "Lunedi'",
  Tuesday: "Martedi'",
  Wednesday: "Mercoledi'",
  Thursday: "Giovedi'",
  Friday: "Venerdi'",
  Saturday: "Sabato",
  Sunday: "Domenica",
};

const DISTANCE_LABELS = {
  sprint: "Sprint",
  olympic: "Olimpico",
  "70.3": "70.3",
  ironman: "Ironman",
  custom: "Custom endurance",
};

const DISTANCE_PROFILES = {
  sprint: { weeklyHours: 6, swimShare: 0.24, bikeShare: 0.38, runShare: 0.28 },
  olympic: { weeklyHours: 8, swimShare: 0.24, bikeShare: 0.4, runShare: 0.28 },
  "70.3": { weeklyHours: 11, swimShare: 0.2, bikeShare: 0.45, runShare: 0.27 },
  ironman: { weeklyHours: 14, swimShare: 0.19, bikeShare: 0.47, runShare: 0.26 },
  custom: { weeklyHours: 8, swimShare: 0.23, bikeShare: 0.39, runShare: 0.28 },
};

const STORAGE_KEY = "triathlonPlanner.savedPlans.v1";

const SESSION_LIBRARY = {
  swim: {
    technique: { title: "Swim tecnica", short: "Drill, assetto e controllo di bracciata." },
    aerobic: { title: "Swim aerobic build", short: "Serie medie continue in controllo." },
    threshold: { title: "Swim CSS / soglia", short: "Blocchi a passo gara o CSS." },
    speed: { title: "Swim speed", short: "Ripetute brevi, brillanti e pulite." },
    endurance: { title: "Swim endurance", short: "Serie lunghe per continuita' e tenuta." },
  },
  bike: {
    recovery: { title: "Bike recovery", short: "Pedalata agile e rigenerante." },
    tempo: { title: "Bike tempo", short: "Lavoro continuo a ritmo medio-sostenuto." },
    threshold: { title: "Bike threshold", short: "Intervalli a soglia ben controllati." },
    hills: { title: "Bike hills / VO2", short: "Salite o blocchi sopra soglia." },
    long: { title: "Long ride", short: "Uscita lunga con fueling e ritmo costante." },
    brick: { title: "Bike brick prep", short: "Bici orientata alla transizione corsa." },
  },
  run: {
    easy: { title: "Easy run", short: "Corsa facile di costruzione aerobica." },
    tempo: { title: "Tempo run", short: "Lavoro continuo o spezzato a ritmo soglia." },
    speed: { title: "Speed run", short: "Ripetute brevi per velocita' ed economia." },
    block: { title: "Block run", short: "Blocchi progressivi con cambi ritmo guidati." },
    long: { title: "Long run", short: "Lungo aerobico con finale stabile." },
    brick: { title: "Brick run", short: "Corsa post bici per rendere fluida la transizione." },
  },
};

const state = {
  plan: null,
  currentWeekIndex: 0,
  sessionLookup: new Map(),
  currentSavedPlanId: null,
  feedbackTimeoutId: null,
  deviceFeedbackTimeoutId: null,
  deferredInstallPrompt: null,
};

const form = document.querySelector("#athlete-form");
const availabilityGrid = document.querySelector("#availability-grid");
const template = document.querySelector("#day-row-template");
const demoButton = document.querySelector("#demo-button");
const locationButton = document.querySelector("#location-button");
const emptyState = document.querySelector("#empty-state");
const results = document.querySelector("#results");
const summaryCards = document.querySelector("#summary-cards");
const coachNote = document.querySelector("#coach-note");
const cycleSummary = document.querySelector("#cycle-summary");
const weekIndicator = document.querySelector("#week-indicator");
const prevWeekButton = document.querySelector("#prev-week-button");
const nextWeekButton = document.querySelector("#next-week-button");
const savePlanButton = document.querySelector("#save-plan-button");
const saveFeedback = document.querySelector("#save-feedback");
const weeklyPlan = document.querySelector("#weekly-plan");
const routeSuggestions = document.querySelector("#route-suggestions");
const savedPlansList = document.querySelector("#saved-plans-list");
const savedPlansEmpty = document.querySelector("#saved-plans-empty");
const sessionModal = document.querySelector("#session-modal");
const sessionDetail = document.querySelector("#session-detail");
const closeModalButton = document.querySelector("#close-modal-button");
const planPreview = document.querySelector("#plan-preview");
const startDateWrapper = document.querySelector("#start-date-wrapper");
const raceOnlyFields = Array.from(document.querySelectorAll("[data-race-only]"));
const planModeField = form.elements.namedItem("planMode");
const startModeField = form.elements.namedItem("startMode");
const startDateField = form.elements.namedItem("startDate");
const raceDateField = form.elements.namedItem("raceDate");
const installAppButton = document.querySelector("#install-app-button");
const downloadGarminDraftButton = document.querySelector("#download-garmin-draft-button");
const installHint = document.querySelector("#install-hint");
const garminStatus = document.querySelector("#garmin-status");
const deviceFeedback = document.querySelector("#device-feedback");

buildAvailabilityRows();
attachEvents();
updateStartModeUI();
updatePlanModeUI();
updatePlanPreview();
renderSavedPlansLibrary();
updateSaveButtonState();
renderDeviceReadiness();
registerServiceWorker();
bindInstallPromptEvents();

function attachEvents() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const athlete = collectFormData();
    const validationError = validateAthlete(athlete);

    if (validationError) {
      window.alert(validationError);
      return;
    }

    const plan = generatePlan(athlete);
    state.plan = plan;
    state.currentWeekIndex = 0;
    state.currentSavedPlanId = null;
    rebuildSessionLookup(plan);
    closeSessionModal();
    renderPlan(plan);
    showSaveFeedback("Piano pronto. Ora puoi salvarlo nell'archivio locale.");
  });

  demoButton.addEventListener("click", () => {
    loadDemoData();
    updateStartModeUI();
    updatePlanModeUI();
    updatePlanPreview();
  });

  locationButton.addEventListener("click", useBrowserLocation);
  prevWeekButton.addEventListener("click", () => shiftWeek(-1));
  nextWeekButton.addEventListener("click", () => shiftWeek(1));
  savePlanButton.addEventListener("click", saveCurrentPlan);
  if (installAppButton) installAppButton.addEventListener("click", handleInstallApp);
  if (downloadGarminDraftButton) downloadGarminDraftButton.addEventListener("click", downloadGarminSyncDraft);
  savedPlansList.addEventListener("click", handleSavedPlanAction);
  closeModalButton.addEventListener("click", closeSessionModal);
  sessionModal.addEventListener("click", (event) => {
    if (event.target === sessionModal) {
      closeSessionModal();
    }
  });

  weeklyPlan.addEventListener("click", (event) => {
    const card = event.target.closest("[data-session-id]");
    if (!card) {
      return;
    }
    openSessionModal(card.dataset.sessionId);
  });

  [planModeField, startModeField, startDateField, raceDateField, form.elements.namedItem("focusDistance")].forEach((field) => {
    field.addEventListener("change", () => {
      updateStartModeUI();
      updatePlanModeUI();
      updatePlanPreview();
    });
  });
}

function buildAvailabilityRows() {
  DAYS.forEach((day, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.day = day;
    node.querySelector(".day-name").textContent = DAY_LABELS[day];
    node.querySelector(".day-available").name = `${day}-available`;
    node.querySelector(".day-available").checked = index !== 4;
    node.querySelector(".work-start").name = `${day}-work-start`;
    node.querySelector(".work-end").name = `${day}-work-end`;
    node.querySelector(".day-preference").name = `${day}-preference`;

    if (["Monday", "Tuesday", "Wednesday", "Thursday"].includes(day)) {
      node.querySelector(".work-start").value = "09:00";
      node.querySelector(".work-end").value = "18:00";
    }

    if (day === "Saturday") {
      node.querySelector(".day-preference").value = "long";
    }

    availabilityGrid.appendChild(node);
  });
}

function updateStartModeUI() {
  const isCustom = startModeField.value === "custom";
  startDateWrapper.classList.toggle("hidden-field", !isCustom);
  startDateField.min = formatDateInput(new Date());

  if (!startDateField.value) {
    startDateField.value = formatDateInput(new Date());
  }
}

function updatePlanModeUI() {
  const isMaintenance = planModeField.value === "maintenance";
  raceOnlyFields.forEach((field) => field.classList.toggle("hidden-field", isMaintenance));
  raceDateField.required = !isMaintenance;
}

function updatePlanPreview() {
  const startDate = resolveChosenStartDate();
  const planMode = planModeField.value;

  if (!startDate) {
    planPreview.textContent = "Scegli una data di partenza valida per generare l'anteprima del piano.";
    planPreview.dataset.state = "warning";
    return;
  }

  if (planMode === "maintenance") {
    planPreview.textContent = `Partenza ${formatLongDate(parseDateLocal(startDate))}. Modalita' mantenimento: verra' creato un ciclo rolling di 4 settimane, pensato per restare allenata senza deadline di gara.`;
    planPreview.dataset.state = "ok";
    return;
  }

  if (!raceDateField.value) {
    planPreview.textContent = "Inserisci la gara finale e il planner calcolera' da solo quante settimane di preparazione servono.";
    planPreview.dataset.state = "warning";
    return;
  }

  const start = parseDateLocal(startDate);
  const race = parseDateLocal(raceDateField.value);

  if (race < start) {
    planPreview.textContent = "La data gara deve essere uguale o successiva alla partenza.";
    planPreview.dataset.state = "warning";
    return;
  }

  const totalWeeks = diffWeekBlocks(start, race);
  planPreview.textContent = `Partenza ${formatLongDate(start)}. Gara finale ${formatLongDate(race)}. Preparazione calcolata automaticamente: ${totalWeeks} ${totalWeeks === 1 ? "settimana" : "settimane"}.`;
  planPreview.dataset.state = "ok";
}

function collectFormData() {
  const formData = new FormData(form);
  const days = DAYS.map((day) => ({
    day,
    available: formData.get(`${day}-available`) === "on",
    workStart: formData.get(`${day}-work-start`) || "",
    workEnd: formData.get(`${day}-work-end`) || "",
    preference: formData.get(`${day}-preference`) || "flexible",
  }));

  return {
    fullName: String(formData.get("fullName")).trim(),
    age: Number(formData.get("age")),
    sex: String(formData.get("sex")),
    heightCm: Number(formData.get("heightCm")) || null,
    weightKg: Number(formData.get("weightKg")) || null,
    city: String(formData.get("city") || "").trim(),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    swim400: parseDurationToMinutes(String(formData.get("swim400") || "")),
    swim1500: parseDurationToMinutes(String(formData.get("swim1500") || "")),
    run5k: parseDurationToMinutes(String(formData.get("run5k") || "")),
    run10k: parseDurationToMinutes(String(formData.get("run10k") || "")),
    run21k: parseDurationToMinutes(String(formData.get("run21k") || "")),
    run42k: parseDurationToMinutes(String(formData.get("run42k") || "")),
    bike20k: parseDurationToMinutes(String(formData.get("bike20k") || "")),
    bike40k: parseDurationToMinutes(String(formData.get("bike40k") || "")),
    planMode: String(formData.get("planMode")),
    focusDistance: String(formData.get("focusDistance")),
    startMode: String(formData.get("startMode")),
    startDate: resolveChosenStartDate(),
    eventName: String(formData.get("eventName") || "").trim(),
    raceDate: String(formData.get("raceDate") || ""),
    targetWeeklyHours: Number(formData.get("targetWeeklyHours")) || null,
    goalText: String(formData.get("goalText") || "").trim(),
    earliestTraining: formData.get("earliestTraining") || "06:00",
    latestTraining: formData.get("latestTraining") || "21:30",
    constraints: String(formData.get("constraints") || "").trim(),
    days,
  };
}

function resolveChosenStartDate() {
  if (startModeField.value === "today") {
    return formatDateInput(new Date());
  }
  return String(startDateField.value || "");
}

function validateAthlete(athlete) {
  if (!athlete.days.some((day) => day.available)) {
    return "Seleziona almeno un giorno disponibile per creare il piano.";
  }

  if (!athlete.startDate) {
    return "Inserisci una data di partenza valida.";
  }

  const today = parseDateLocal(formatDateInput(new Date()));
  const start = parseDateLocal(athlete.startDate);

  if (start < today) {
    return "La partenza puo' essere oggi o in futuro, non nel passato.";
  }

  if (athlete.planMode === "race") {
    if (!athlete.raceDate) {
      return "Inserisci la data della gara finale.";
    }
    const race = parseDateLocal(athlete.raceDate);
    if (race < start) {
      return "La gara finale deve essere uguale o successiva alla partenza.";
    }
  }

  if (!Number.isFinite(athlete.latitude) || !Number.isFinite(athlete.longitude)) {
    return "Inserisci latitudine e longitudine valide per il calcolo della luce diurna.";
  }

  return null;
}

function generatePlan(athlete) {
  const performance = estimatePerformanceProfile(athlete);
  const baseline = DISTANCE_PROFILES[athlete.focusDistance] || DISTANCE_PROFILES.custom;
  const planConfig = derivePlanConfig(athlete);
  const availabilityMinutes = estimateWeeklyAvailabilityMinutes(athlete);
  const weeks = [];

  for (let weekIndex = 0; weekIndex < planConfig.totalWeeks; weekIndex += 1) {
    const weekStart = addDays(planConfig.startDateObj, weekIndex * 7);
    const phase = determineWeekPhase(planConfig, weekStart, weekIndex);
    const weekVariation = resolveWeekVariation(phase, weekIndex, planConfig);
    const weekHours = estimateWeeklyHours(
      athlete,
      performance.level,
      baseline,
      availabilityMinutes,
      phase,
      planConfig,
      weekVariation,
    );
    const weeklyTargets = deriveWeeklyTargetsKm(weekHours, baseline, performance);
    weeks.push(
      buildWeekSchedule(
        athlete,
        performance,
        planConfig,
        weekStart,
        weekIndex,
        phase,
        weekVariation,
        weekHours,
        weeklyTargets,
      ),
    );
  }

  return {
    athlete,
    performance,
    baseline,
    planConfig,
    availabilityMinutes,
    weeks,
  };
}

function estimatePerformanceProfile(athlete) {
  const swimRefs = {
    pace400: athlete.swim400 ? athlete.swim400 / 4 : null,
    pace1500: athlete.swim1500 ? athlete.swim1500 / 15 : null,
  };

  const runRefs = {
    pace5k: athlete.run5k ? athlete.run5k / 5 : null,
    pace10k: athlete.run10k ? athlete.run10k / 10 : null,
    pace21k: athlete.run21k ? athlete.run21k / 21.0975 : null,
    pace42k: athlete.run42k ? athlete.run42k / 42.195 : null,
  };

  const bikeRefs = {
    speed20k: athlete.bike20k ? 20 / (athlete.bike20k / 60) : null,
    speed40k: athlete.bike40k ? 40 / (athlete.bike40k / 60) : null,
  };

  const swimPace = average([swimRefs.pace400, swimRefs.pace1500].filter(Boolean));
  const runPace = average([runRefs.pace10k, runRefs.pace21k, runRefs.pace42k, runRefs.pace5k].filter(Boolean));
  const bikeSpeed = average([bikeRefs.speed20k, bikeRefs.speed40k].filter(Boolean));

  const swimScore = swimPace ? scoreFromThresholds(swimPace, [1.7, 2.0, 2.25, 2.6], true) : 2;
  const runScore = runPace ? scoreFromThresholds(runPace, [4.2, 4.7, 5.3, 6.0], true) : 2;
  const bikeScore = bikeSpeed ? scoreFromThresholds(bikeSpeed, [35, 31, 28, 24], false) : 2;
  const overallScore = average([swimScore, runScore, bikeScore]);

  return {
    swimPace: swimPace || 2.15,
    runPace: runPace || 5.7,
    bikeSpeed: bikeSpeed || 27,
    swimRefs,
    runRefs,
    bikeRefs,
    level: resolveLevel(overallScore),
    strengths: rankStrengths({ swimScore, bikeScore, runScore }),
  };
}

function derivePlanConfig(athlete) {
  const startDateObj = parseDateLocal(athlete.startDate);

  if (athlete.planMode === "maintenance") {
    return {
      planMode: athlete.planMode,
      startDateObj,
      raceDateObj: null,
      totalWeeks: 4,
      eventLabel: "Mantenimento continuo",
    };
  }

  const raceDateObj = parseDateLocal(athlete.raceDate);
  return {
    planMode: athlete.planMode,
    startDateObj,
    raceDateObj,
    totalWeeks: diffWeekBlocks(startDateObj, raceDateObj),
    eventLabel: athlete.eventName || `Gara ${DISTANCE_LABELS[athlete.focusDistance]}`,
  };
}

function determineWeekPhase(planConfig, weekStart, weekIndex) {
  if (planConfig.planMode === "maintenance") {
    const cycle = [
      { name: "Maintenance build", bucket: "Base", loadFactor: 0.92, detail: "Costruzione leggera senza picchi." },
      { name: "Maintenance steady", bucket: "Build", loadFactor: 1, detail: "Tenuta costante e ritmo." },
      { name: "Maintenance sharpen", bucket: "Peak", loadFactor: 1.03, detail: "Richiami di brillantezza senza sovraccarico." },
      { name: "Maintenance recovery", bucket: "Recovery", loadFactor: 0.82, detail: "Scarico attivo per restare fresca." },
    ];

    return { ...cycle[weekIndex % cycle.length], weeksToRace: null };
  }

  const weeksToRace = diffWeekBlocks(weekStart, planConfig.raceDateObj);

  if (weeksToRace <= 1) {
    return { name: "Race week", bucket: "Taper", loadFactor: 0.58, detail: "Ultimi richiami, zero zavorra.", weeksToRace };
  }
  if (weeksToRace <= 2) {
    return { name: "Taper", bucket: "Taper", loadFactor: 0.72, detail: "Riduzione del carico, freschezza al centro.", weeksToRace };
  }
  if (weeksToRace <= 6) {
    return { name: "Peak", bucket: "Peak", loadFactor: 0.96, detail: "Specificita' gara e intensita' mirata.", weeksToRace };
  }
  if (weeksToRace <= 12) {
    return { name: "Build", bucket: "Build", loadFactor: 1, detail: "Sviluppo della qualita' e resistenza specifica.", weeksToRace };
  }
  if (weekIndex % 4 === 3) {
    return { name: "Base recovery", bucket: "Recovery", loadFactor: 0.84, detail: "Scarico intelligente dentro la base.", weeksToRace };
  }

  return { name: "Base", bucket: "Base", loadFactor: 0.93, detail: "Volume progressivo, tecnica e tenuta aerobica.", weeksToRace };
}

function resolveWeekVariation(phase, weekIndex, planConfig) {
  const cycleIndex = weekIndex % 4;

  if (planConfig.planMode === "maintenance") {
    const cycle = [
      { label: "costruzione aerobica", volumeFactor: 0.96, structureIndex: 0, includeBrick: false },
      { label: "qualita' controllata", volumeFactor: 1.02, structureIndex: 1, includeBrick: true },
      { label: "specifico brillante", volumeFactor: 1.05, structureIndex: 2, includeBrick: true },
      { label: "scarico attivo", volumeFactor: 0.84, structureIndex: 3, includeBrick: false },
    ];
    return { ...cycle[cycleIndex], cycleIndex };
  }

  const patterns = {
    Base: [
      { label: "tecnica e costruzione", volumeFactor: 0.94, structureIndex: 0, includeBrick: false },
      { label: "volume pulito", volumeFactor: 1, structureIndex: 1, includeBrick: false },
      { label: "progressione controllata", volumeFactor: 1.05, structureIndex: 2, includeBrick: true },
      { label: "scarico base", volumeFactor: 0.84, structureIndex: 3, includeBrick: false },
    ],
    Build: [
      { label: "tempo e tenuta", volumeFactor: 0.96, structureIndex: 0, includeBrick: false },
      { label: "forza e salita", volumeFactor: 1, structureIndex: 1, includeBrick: true },
      { label: "specifico di ritmo", volumeFactor: 1.05, structureIndex: 2, includeBrick: true },
      { label: "scarico build", volumeFactor: 0.84, structureIndex: 3, includeBrick: false },
    ],
    Peak: [
      { label: "specificita' gara", volumeFactor: 0.96, structureIndex: 0, includeBrick: true },
      { label: "brick e passo gara", volumeFactor: 1, structureIndex: 1, includeBrick: true },
      { label: "qualita' compatta", volumeFactor: 0.95, structureIndex: 2, includeBrick: false },
      { label: "freshen up", volumeFactor: 0.88, structureIndex: 3, includeBrick: false },
    ],
    Taper: [
      { label: "riduzione del carico", volumeFactor: 0.9, structureIndex: 0, includeBrick: false },
      { label: "richiami di gamba", volumeFactor: 0.84, structureIndex: 1, includeBrick: false },
      { label: "freschezza", volumeFactor: 0.78, structureIndex: 2, includeBrick: false },
      { label: "settimana gara", volumeFactor: 0.72, structureIndex: 3, includeBrick: false },
    ],
    Recovery: [
      { label: "scarico strutturato", volumeFactor: 0.82, structureIndex: 3, includeBrick: false },
      { label: "scarico strutturato", volumeFactor: 0.82, structureIndex: 3, includeBrick: false },
      { label: "scarico strutturato", volumeFactor: 0.82, structureIndex: 3, includeBrick: false },
      { label: "scarico strutturato", volumeFactor: 0.82, structureIndex: 3, includeBrick: false },
    ],
  };

  const bucketPatterns = patterns[phase.bucket] || patterns.Base;
  return { ...bucketPatterns[cycleIndex], cycleIndex };
}

function estimateWeeklyAvailabilityMinutes(athlete) {
  return athlete.days
    .filter((day) => day.available)
    .reduce((total, day) => total + buildDayWindows(day, athlete.earliestTraining, athlete.latestTraining).reduce((sum, window) => sum + windowDuration(window), 0), 0);
}

function estimateWeeklyHours(athlete, level, baseline, availabilityMinutes, phase, planConfig, weekVariation) {
  const availabilityFactor = clamp(athlete.days.filter((day) => day.available).length / 6, 0.6, 1.15);
  const experienceFactor = {
    novice: 0.82,
    developing: 0.94,
    solid: 1,
    competitive: 1.08,
  }[level];
  const modeFactor = planConfig.planMode === "maintenance" ? 0.9 : 1;
  const availableHoursCap = Math.max(4, (availabilityMinutes * 0.82) / 60);
  const baselineHours = baseline.weeklyHours * availabilityFactor * experienceFactor * phase.loadFactor * modeFactor;
  const targetHours = athlete.targetWeeklyHours || baselineHours;
  const modulatedHours = targetHours * weekVariation.volumeFactor;

  return roundToHalfHour(clamp(Math.min(modulatedHours, availableHoursCap), 4, 18));
}

function deriveWeeklyTargetsKm(weekHours, baseline, performance) {
  const swimMinutes = weekHours * baseline.swimShare * 60;
  const bikeMinutes = weekHours * baseline.bikeShare * 60;
  const runMinutes = weekHours * baseline.runShare * 60;

  return {
    swimKm: roundDistanceForSport("swim", minutesToSwimKm(swimMinutes, performance.swimPace)),
    bikeKm: roundDistanceForSport("bike", minutesToBikeKm(bikeMinutes, performance.bikeSpeed)),
    runKm: roundDistanceForSport("run", minutesToRunKm(runMinutes, performance.runPace)),
  };
}

function buildWeekSchedule(athlete, performance, planConfig, weekStart, weekIndex, phase, weekVariation, weekHours, weeklyTargets) {
  const calendarDays = buildCalendarDays(athlete, weekStart, planConfig);
  const availableDays = calendarDays.filter((day) => day.available);
  const priorities = buildPriorityPools(availableDays);
  const workoutTypes = resolveWorkoutTypes(phase.bucket, athlete.focusDistance, performance, weekVariation);
  const blueprints = buildSessionBlueprints(
    weeklyTargets,
    workoutTypes,
    phase,
    availableDays.length,
    planConfig.planMode,
    weekVariation,
  );
  const dayMap = new Map(calendarDays.map((day) => [day.key, { ...day, sessions: [], usedWindowIndexes: [] }]));
  const assignedByBlueprint = {};

  blueprints.forEach((blueprint) => {
    const session = assignBlueprint(
      blueprint,
      dayMap,
      priorities,
      athlete,
      performance,
      phase,
      weekVariation,
      assignedByBlueprint,
      planConfig,
    );
    if (session) {
      assignedByBlueprint[blueprint.id] = session;
    }
  });

  const days = Array.from(dayMap.values()).map((day) => ({
    ...day,
    sessions: [...day.sessions].sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime)),
  }));

  const totals = computeWeekTotals(days);

  return {
    weekIndex,
    label: `Settimana ${weekIndex + 1}`,
    startLabel: formatShortDate(calendarDays[0].date),
    endLabel: formatShortDate(calendarDays.at(-1).date),
    phase,
    variation: weekVariation,
    weekHours,
    weeklyTargets,
    totals,
    days,
  };
}

function buildCalendarDays(athlete, weekStart, planConfig) {
  const days = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    if (planConfig.planMode === "race" && date > planConfig.raceDateObj) {
      break;
    }

    const dayName = JS_DAY_NAMES[date.getDay()];
    const templateDay = athlete.days.find((item) => item.day === dayName);
    const windows = templateDay.available ? buildDayWindows(templateDay, athlete.earliestTraining, athlete.latestTraining) : [];
    const daylight = calculateSunTimes(date, athlete.latitude, athlete.longitude);

    days.push({
      key: formatDateInput(date),
      date,
      dayName,
      dayLabel: DAY_LABELS[dayName],
      dateLabel: formatMediumDate(date),
      available: templateDay.available,
      preference: templateDay.preference,
      workLabel: templateDay.workStart && templateDay.workEnd ? `${templateDay.workStart} - ${templateDay.workEnd}` : "Giorno libero",
      windows,
      daylight,
      longestWindowMinutes: Math.max(...windows.map(windowDuration), 0),
      isRaceDay: planConfig.planMode === "race" && sameDate(date, planConfig.raceDateObj),
    });
  }

  return days;
}

function buildPriorityPools(availableDays) {
  const allKeys = availableDays.map((day) => day.key);
  const sortedByLong = [...availableDays].sort((left, right) => {
    const pref = preferenceScore(left.preference) - preferenceScore(right.preference);
    if (pref !== 0) return pref;
    const weekendBias = weekendScore(right.dayName) - weekendScore(left.dayName);
    if (weekendBias !== 0) return weekendBias;
    return right.longestWindowMinutes - left.longestWindowMinutes;
  });

  return {
    all: allKeys,
    longDays: sortedByLong.map((day) => day.key),
    bikePrimary: sortByPreference(availableDays, ["evening", "flexible", "long", "early"]).map((day) => day.key),
    bikeSecondary: sortByPreference(availableDays, ["flexible", "evening", "early", "long"]).map((day) => day.key),
    runPrimary: sortByPreference(availableDays, ["early", "flexible", "evening", "long"]).map((day) => day.key),
    runSecondary: sortByPreference(availableDays, ["flexible", "early", "evening", "long"]).map((day) => day.key),
    swimPrimary: sortByPreference(availableDays, ["early", "flexible", "evening", "long"]).map((day) => day.key),
    swimSecondary: sortByPreference(availableDays, ["evening", "flexible", "early", "long"]).map((day) => day.key),
    swimSupport: sortByPreference(availableDays, ["flexible", "early", "evening", "long"]).map((day) => day.key),
  };
}

function resolveWorkoutTypes(bucket, focusDistance, performance, weekVariation) {
  const cycleIndex = weekVariation.structureIndex % 4;
  const longerRace = ["70.3", "ironman"].includes(focusDistance);
  const quickRunner = performance.runPace < 4.95;
  const strongBiker = performance.bikeSpeed > 31;

  if (bucket === "Taper") {
    return {
      swimPrimary: ["threshold", "speed", "technique", "speed"][cycleIndex],
      swimSecondary: ["technique", "aerobic", "technique", "technique"][cycleIndex],
      swimSupport: ["technique", "technique", "aerobic", "technique"][cycleIndex],
      bikePrimary: ["tempo", "threshold", "recovery", "tempo"][cycleIndex],
      bikeSecondary: ["recovery", "brick", "recovery", "recovery"][cycleIndex],
      runPrimary: ["tempo", "speed", "easy", "tempo"][cycleIndex],
      runSecondary: ["easy", "easy", "easy", "easy"][cycleIndex],
    };
  }

  if (bucket === "Peak") {
    return {
      swimPrimary: ["threshold", "speed", "threshold", "technique"][cycleIndex],
      swimSecondary: ["speed", "aerobic", "endurance", "technique"][cycleIndex],
      swimSupport: ["technique", "technique", "aerobic", "technique"][cycleIndex],
      bikePrimary: longerRace
        ? ["tempo", "threshold", "tempo", "recovery"][cycleIndex]
        : ["threshold", "tempo", "hills", "recovery"][cycleIndex],
      bikeSecondary: ["brick", "tempo", "recovery", "recovery"][cycleIndex],
      runPrimary: longerRace
        ? ["block", "tempo", "block", "easy"][cycleIndex]
        : ["tempo", "speed", "block", "easy"][cycleIndex],
      runSecondary: ["brick", "easy", "tempo", "easy"][cycleIndex],
    };
  }

  if (bucket === "Build") {
    return {
      swimPrimary: ["threshold", "aerobic", "speed", "technique"][cycleIndex],
      swimSecondary: ["aerobic", "threshold", "endurance", "technique"][cycleIndex],
      swimSupport: ["technique", "aerobic", "technique", "technique"][cycleIndex],
      bikePrimary: longerRace
        ? ["tempo", "threshold", "tempo", "recovery"][cycleIndex]
        : strongBiker
          ? ["tempo", "hills", "threshold", "recovery"][cycleIndex]
          : ["tempo", "threshold", "hills", "recovery"][cycleIndex],
      bikeSecondary: ["recovery", "tempo", "brick", "recovery"][cycleIndex],
      runPrimary: longerRace
        ? ["tempo", "block", "tempo", "easy"][cycleIndex]
        : quickRunner
          ? ["tempo", "speed", "block", "easy"][cycleIndex]
          : ["block", "tempo", "speed", "easy"][cycleIndex],
      runSecondary: ["easy", "easy", "tempo", "easy"][cycleIndex],
    };
  }

  return {
    swimPrimary: ["technique", "aerobic", "threshold", "technique"][cycleIndex],
    swimSecondary: ["endurance", "aerobic", "endurance", "aerobic"][cycleIndex],
    swimSupport: ["technique", "aerobic", "technique", "technique"][cycleIndex],
    bikePrimary: strongBiker
      ? ["tempo", "threshold", "tempo", "recovery"][cycleIndex]
      : ["recovery", "tempo", "threshold", "recovery"][cycleIndex],
    bikeSecondary: ["tempo", "recovery", "tempo", "recovery"][cycleIndex],
    runPrimary: quickRunner
      ? ["tempo", "block", "speed", "easy"][cycleIndex]
      : ["block", "tempo", "speed", "easy"][cycleIndex],
    runSecondary: ["easy", "easy", "tempo", "easy"][cycleIndex],
  };
}

function buildSessionBlueprints(weeklyTargets, workoutTypes, phase, availableDayCount, planMode, weekVariation) {
  const cycleIndex = weekVariation.structureIndex % 4;
  const includeBrick = planMode === "race" && phase.bucket !== "Taper" && availableDayCount >= 4 && weekVariation.includeBrick;
  const swimPrimaryShare = [0.42, 0.46, 0.44, 0.38][cycleIndex];
  const swimSecondaryShare = [0.36, 0.3, 0.32, 0.44][cycleIndex];
  const bikeLongShare = [0.46, 0.5, 0.54, 0.4][cycleIndex];
  const bikePrimaryShare = [0.28, 0.24, 0.26, 0.22][cycleIndex];
  const runLongShare = [0.38, 0.42, 0.46, 0.34][cycleIndex];
  const runPrimaryShare = [0.24, 0.28, 0.3, 0.22][cycleIndex];
  const runBrickShare = includeBrick ? [0.1, 0.08, 0.12, 0.04][cycleIndex] : 0;

  const swimPrimaryKm = roundDistanceForSport("swim", weeklyTargets.swimKm * swimPrimaryShare);
  const swimSecondaryKm = roundDistanceForSport("swim", weeklyTargets.swimKm * swimSecondaryShare);
  const swimSupportKm = roundDistanceForSport("swim", Math.max(0, weeklyTargets.swimKm - swimPrimaryKm - swimSecondaryKm));

  const bikeLongKm = roundDistanceForSport("bike", weeklyTargets.bikeKm * bikeLongShare);
  const bikePrimaryKm = roundDistanceForSport("bike", weeklyTargets.bikeKm * bikePrimaryShare);
  const bikeSecondaryKm = roundDistanceForSport("bike", Math.max(0, weeklyTargets.bikeKm - bikeLongKm - bikePrimaryKm));

  const runLongKm = roundDistanceForSport("run", weeklyTargets.runKm * runLongShare);
  const runPrimaryKm = roundDistanceForSport("run", weeklyTargets.runKm * runPrimaryShare);
  const runBrickKm = roundDistanceForSport("run", weeklyTargets.runKm * runBrickShare);
  const runSecondaryKm = roundDistanceForSport("run", Math.max(0, weeklyTargets.runKm - runLongKm - runPrimaryKm - runBrickKm));

  const blueprints = [
    { id: `bike-long-${cycleIndex}`, sport: "bike", type: "long", distanceKm: bikeLongKm, priority: "longDays", longSession: true },
    { id: `run-long-${cycleIndex}`, sport: "run", type: "long", distanceKm: runLongKm, priority: "longDays", longSession: true, avoidBlueprintId: `bike-long-${cycleIndex}` },
    { id: `bike-primary-${cycleIndex}`, sport: "bike", type: workoutTypes.bikePrimary, distanceKm: bikePrimaryKm, priority: "bikePrimary" },
    { id: `run-primary-${cycleIndex}`, sport: "run", type: workoutTypes.runPrimary, distanceKm: runPrimaryKm, priority: "runPrimary" },
    { id: `swim-primary-${cycleIndex}`, sport: "swim", type: workoutTypes.swimPrimary, distanceKm: swimPrimaryKm, priority: "swimPrimary" },
    { id: `swim-secondary-${cycleIndex}`, sport: "swim", type: workoutTypes.swimSecondary, distanceKm: swimSecondaryKm, priority: "swimSecondary" },
  ];

  if (bikeSecondaryKm >= (cycleIndex === 3 ? 16 : 18)) {
    blueprints.push({ id: `bike-secondary-${cycleIndex}`, sport: "bike", type: workoutTypes.bikeSecondary, distanceKm: bikeSecondaryKm, priority: "bikeSecondary" });
  }
  if (runSecondaryKm >= (cycleIndex === 3 ? 3.5 : 4)) {
    blueprints.push({ id: `run-secondary-${cycleIndex}`, sport: "run", type: workoutTypes.runSecondary, distanceKm: runSecondaryKm, priority: "runSecondary" });
  }
  if (swimSupportKm >= 1) {
    blueprints.push({ id: `swim-support-${cycleIndex}`, sport: "swim", type: workoutTypes.swimSupport, distanceKm: swimSupportKm, priority: "swimSupport" });
  }
  if (includeBrick && runBrickKm >= 2.5) {
    blueprints.push({ id: `run-brick-${cycleIndex}`, sport: "run", type: "brick", distanceKm: runBrickKm, priority: "runSecondary", sameDayAs: `bike-long-${cycleIndex}` });
  }

  return blueprints.filter((blueprint) => blueprint.distanceKm > 0);
}

function assignBlueprint(blueprint, dayMap, priorities, athlete, performance, phase, weekVariation, assignedByBlueprint, planConfig) {
  const preferredKeys = [];

  if (blueprint.sameDayAs && assignedByBlueprint[blueprint.sameDayAs]) {
    preferredKeys.push(assignedByBlueprint[blueprint.sameDayAs].dayKey);
  }

  preferredKeys.push(...(priorities[blueprint.priority] || []));
  preferredKeys.push(...priorities.all);

  const candidateKeys = [...new Set(preferredKeys)].filter((key) => {
    if (blueprint.avoidBlueprintId && assignedByBlueprint[blueprint.avoidBlueprintId]?.dayKey === key && priorities.all.length > 1) {
      return false;
    }
    return true;
  });

  for (const key of candidateKeys) {
    const day = dayMap.get(key);
    if (!day || !day.available) {
      continue;
    }
    if (day.sessions.some((session) => session.sport === blueprint.sport)) {
      continue;
    }
    if (day.usedWindowIndexes.length >= day.windows.length) {
      continue;
    }

    const requiredMinutes = estimateMinutesForDistance(blueprint.sport, blueprint.type, blueprint.distanceKm, performance);
    const chosenWindow = pickWindowForSession(day, blueprint.sport, requiredMinutes);

    if (!chosenWindow) {
      continue;
    }

    const session = materializeSession(blueprint, day, chosenWindow, athlete, performance, phase, weekVariation, planConfig);
    day.sessions.push(session);
    day.usedWindowIndexes.push(chosenWindow.index);
    return session;
  }

  return null;
}

function pickWindowForSession(day, sport, requiredMinutes) {
  const windows = day.windows
    .map((window, index) => ({ ...window, index }))
    .filter((window) => !day.usedWindowIndexes.includes(window.index));

  if (!windows.length) {
    return null;
  }

  const fittingWindows = windows.filter((window) => windowDuration(window) >= requiredMinutes + 5);
  const daylightPreferred = chooseDaylightWindow(fittingWindows, day.daylight, sport);
  if (daylightPreferred) {
    return daylightPreferred;
  }
  if (fittingWindows[0]) {
    return fittingWindows.sort((left, right) => windowDuration(right) - windowDuration(left))[0];
  }

  const partialDaylight = chooseDaylightWindow(windows, day.daylight, sport);
  if (partialDaylight) {
    return partialDaylight;
  }

  return windows.sort((left, right) => windowDuration(right) - windowDuration(left))[0] || null;
}

function materializeSession(blueprint, day, chosenWindow, athlete, performance, phase, weekVariation, planConfig) {
  const library = SESSION_LIBRARY[blueprint.sport][blueprint.type];
  const fullMinutes = estimateMinutesForDistance(blueprint.sport, blueprint.type, blueprint.distanceKm, performance);
  const availableMinutes = windowDuration(chosenWindow);
  const fitRatio = clamp((availableMinutes - 5) / fullMinutes, 0.72, 1);
  const shortened = fitRatio < 0.98;
  const distanceKm = shortened ? roundDistanceForSport(blueprint.sport, blueprint.distanceKm * fitRatio) : blueprint.distanceKm;
  const estimatedMinutes = estimateMinutesForDistance(blueprint.sport, blueprint.type, distanceKm, performance);
  const endTime = addMinutesToTime(chosenWindow.start, estimatedMinutes);
  const paceCue = resolvePaceCue(blueprint.sport, blueprint.type, performance);
  const structure = buildWorkoutStructure(blueprint.sport, blueprint.type, distanceKm, performance, weekVariation);
  const environment = resolveEnvironment(blueprint.sport, chosenWindow, day.daylight);
  const whereToGo = resolveLocationHint(blueprint.sport, blueprint.type, athlete.city, environment, distanceKm);
  const comments = buildCoachComment(blueprint.sport, blueprint.type, phase, shortened, weekVariation);
  const approach = buildApproachNote(blueprint.sport, blueprint.type, blueprint.longSession);

  return {
    id: `${day.key}-${blueprint.id}`,
    dayKey: day.key,
    date: day.date,
    dateLabel: day.dateLabel,
    dayLabel: day.dayLabel,
    sport: blueprint.sport,
    type: blueprint.type,
    title: library.title,
    shortDescription: library.short,
    distanceKm,
    estimatedMinutes,
    startTime: chosenWindow.start,
    endTime,
    paceCue,
    structure,
    environment,
    whereToGo,
    comments,
    approach,
    phaseName: phase.name,
    variationLabel: weekVariation.label,
    longSession: Boolean(blueprint.longSession),
    windowLabel: `${chosenWindow.start} - ${chosenWindow.end}`,
    daylightLabel: day.daylight ? `${day.daylight.sunrise} - ${day.daylight.sunset}` : "non disponibile",
    detailSummary: `${formatDistance(distanceKm, blueprint.sport)} · ${formatDuration(estimatedMinutes)} · ${paceCue}`,
  };
}

function computeWeekTotals(days) {
  const sessions = days.flatMap((day) => day.sessions);
  return {
    swimKm: roundDistanceForSport("swim", sessions.filter((item) => item.sport === "swim").reduce((total, item) => total + item.distanceKm, 0)),
    bikeKm: roundDistanceForSport("bike", sessions.filter((item) => item.sport === "bike").reduce((total, item) => total + item.distanceKm, 0)),
    runKm: roundDistanceForSport("run", sessions.filter((item) => item.sport === "run").reduce((total, item) => total + item.distanceKm, 0)),
    totalMinutes: sessions.reduce((total, item) => total + item.estimatedMinutes, 0),
  };
}

function renderPlan(plan) {
  emptyState.classList.add("hidden");
  results.classList.remove("hidden");
  renderSummary(plan);
  renderCoachNote(plan);
  renderWeekState();
  updateSaveButtonState();
  renderSavedPlansLibrary();
}

function renderDeviceReadiness(plan = state.plan) {
  if (!installAppButton || !downloadGarminDraftButton || !installHint || !garminStatus) {
    return;
  }

  const installState = resolveInstallState();
  installAppButton.textContent = installState.label;
  installAppButton.disabled = installState.disabled;
  installHint.textContent = installState.hint;
  downloadGarminDraftButton.disabled = !plan;

  if (!plan) {
    garminStatus.innerHTML = `
      <p class="device-copy">Genera un piano e qui vedrai quante sessioni sono pronte per la futura sync Garmin.</p>
      <p class="device-copy">Il push automatico stile RUNNA richiede backend OAuth e accesso approvato al Garmin Connect Developer Program.</p>
    `;
    return;
  }

  const week = plan.weeks[state.currentWeekIndex];
  const sessions = flattenWeekSessions(week);
  const routeCandidates = sessions.filter((session) => session.longSession || session.type === "hills");

  garminStatus.innerHTML = `
    <p class="device-copy"><strong>${week.label}</strong>: ${sessions.length} sessioni pronte da esportare, ${routeCandidates.length} route candidate per corsa o bici.</p>
    <p class="device-copy">La bozza scaricata contiene dettagli seduta, step, ritmi e indicazioni luogo/orario. Per il push diretto servono Training API per i workout e Courses API per le route.</p>
  `;
}

function updateSaveButtonState() {
  savePlanButton.disabled = !state.plan;
}

function renderSavedPlansLibrary() {
  const savedPlans = getSavedPlans();
  savedPlansEmpty.classList.toggle("hidden", savedPlans.length > 0);

  savedPlansList.innerHTML = savedPlans
    .map((record) => `
      <article class="saved-plan-card ${record.id === state.currentSavedPlanId ? "is-active" : ""}" data-saved-plan-id="${record.id}">
        <div class="saved-plan-topline">
          <div class="saved-plan-meta">
            <h4>${record.label}</h4>
            <p>${record.summary}</p>
          </div>
          <span class="meta-pill">${formatSavedAt(record.savedAt)}</span>
        </div>
        <div class="saved-plan-actions">
          <button type="button" class="small-action" data-saved-action="open">Apri piano</button>
          <button type="button" class="small-action" data-saved-action="load-form">Carica nel form</button>
          <button type="button" class="small-action danger" data-saved-action="delete">Elimina</button>
        </div>
      </article>
    `)
    .join("");
}

function saveCurrentPlan() {
  if (!state.plan) {
    return;
  }

  const defaultLabel = buildSavedPlanLabel(state.plan);
  const chosenLabel = window.prompt("Nome del piano da salvare", defaultLabel);

  if (chosenLabel === null) {
    return;
  }

  const label = chosenLabel.trim() || defaultLabel;
  const savedPlans = getSavedPlans();
  const record = {
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `plan-${Date.now()}`,
    label,
    savedAt: new Date().toISOString(),
    summary: buildSavedPlanSummary(state.plan),
    formSnapshot: captureFormSnapshot(),
    plan: JSON.parse(JSON.stringify(state.plan)),
  };

  savedPlans.unshift(record);
  persistSavedPlans(savedPlans.slice(0, 25));
  state.currentSavedPlanId = record.id;
  renderSavedPlansLibrary();
  showSaveFeedback(`Piano salvato come "${label}".`);
}

function handleSavedPlanAction(event) {
  const button = event.target.closest("[data-saved-action]");
  if (!button) {
    return;
  }

  const card = button.closest("[data-saved-plan-id]");
  if (!card) {
    return;
  }

  const planId = card.dataset.savedPlanId;
  const action = button.dataset.savedAction;

  if (action === "open") {
    openSavedPlan(planId);
    return;
  }

  if (action === "load-form") {
    loadSavedPlanIntoForm(planId);
    return;
  }

  if (action === "delete") {
    deleteSavedPlan(planId);
  }
}

function openSavedPlan(planId) {
  const record = getSavedPlans().find((item) => item.id === planId);
  if (!record) {
    showSaveFeedback("Non ho trovato il piano richiesto nell'archivio.");
    return;
  }

  const plan = hydrateStoredPlan(record.plan);
  state.plan = plan;
  state.currentWeekIndex = 0;
  state.currentSavedPlanId = record.id;
  rebuildSessionLookup(plan);
  closeSessionModal();
  renderPlan(plan);
  showSaveFeedback(`Hai aperto il piano salvato "${record.label}".`);
}

function loadSavedPlanIntoForm(planId) {
  const record = getSavedPlans().find((item) => item.id === planId);
  if (!record) {
    showSaveFeedback("Non ho trovato il piano richiesto nell'archivio.");
    return;
  }

  applyFormSnapshot(record.formSnapshot);
  state.currentSavedPlanId = record.id;
  renderSavedPlansLibrary();
  showSaveFeedback(`Ho ricaricato nel form i dati di "${record.label}".`);
}

function deleteSavedPlan(planId) {
  const savedPlans = getSavedPlans();
  const record = savedPlans.find((item) => item.id === planId);
  if (!record) {
    return;
  }

  const confirmed = window.confirm(`Elimino il piano salvato "${record.label}"?`);
  if (!confirmed) {
    return;
  }

  const nextPlans = savedPlans.filter((item) => item.id !== planId);
  persistSavedPlans(nextPlans);

  if (state.currentSavedPlanId === planId) {
    state.currentSavedPlanId = null;
  }

  renderSavedPlansLibrary();
  showSaveFeedback(`Piano eliminato: "${record.label}".`);
}

function buildSavedPlanLabel(plan) {
  const athleteName = plan.athlete.fullName || "Atleta";
  if (plan.planConfig.planMode === "maintenance") {
    return `${athleteName} · mantenimento`;
  }
  return `${athleteName} · ${plan.planConfig.eventLabel}`;
}

function buildSavedPlanSummary(plan) {
  const athleteName = plan.athlete.fullName || "Atleta";
  const modeLabel = plan.planConfig.planMode === "maintenance"
    ? "mantenimento"
    : `${plan.planConfig.totalWeeks} settimane verso ${plan.planConfig.eventLabel}`;
  return `${athleteName} · ${modeLabel}`;
}

function captureFormSnapshot() {
  const snapshot = {};
  Array.from(form.elements).forEach((field) => {
    if (!field.name) {
      return;
    }
    if (field.type === "checkbox") {
      snapshot[field.name] = field.checked;
      return;
    }
    snapshot[field.name] = field.value;
  });
  return snapshot;
}

function applyFormSnapshot(snapshot) {
  Object.entries(snapshot || {}).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field) {
      return;
    }
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    field.value = value;
  });

  updateStartModeUI();
  updatePlanModeUI();
  updatePlanPreview();
}

function hydrateStoredPlan(storedPlan) {
  const plan = JSON.parse(JSON.stringify(storedPlan));
  plan.planConfig.startDateObj = new Date(plan.planConfig.startDateObj);
  if (plan.planConfig.raceDateObj) {
    plan.planConfig.raceDateObj = new Date(plan.planConfig.raceDateObj);
  }
  plan.weeks.forEach((week) => {
    week.days.forEach((day) => {
      if (day.date) {
        day.date = new Date(day.date);
      }
    });
  });
  return plan;
}

function getSavedPlans() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function persistSavedPlans(savedPlans) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlans));
  } catch (error) {
    window.alert("Non sono riuscita a salvare il piano nel browser. Controlla che lo storage locale sia disponibile.");
  }
}

function showSaveFeedback(message) {
  saveFeedback.textContent = message;
  if (state.feedbackTimeoutId) {
    window.clearTimeout(state.feedbackTimeoutId);
  }
  state.feedbackTimeoutId = window.setTimeout(() => {
    saveFeedback.textContent = "";
  }, 4000);
}

function formatSavedAt(value) {
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderSummary(plan) {
  const bmi = plan.athlete.heightCm && plan.athlete.weightKg
    ? (plan.athlete.weightKg / ((plan.athlete.heightCm / 100) ** 2)).toFixed(1)
    : null;
  const avg = averageWeekTotals(plan.weeks);
  const cards = [
    {
      title: "Ciclo programma",
      body:
        plan.planConfig.planMode === "maintenance"
          ? `Partenza ${formatLongDate(plan.planConfig.startDateObj)} · mantenimento rolling di ${plan.planConfig.totalWeeks} settimane.`
          : `Partenza ${formatLongDate(plan.planConfig.startDateObj)} · ${plan.planConfig.totalWeeks} settimane verso ${plan.planConfig.eventLabel}.`,
    },
    {
      title: "Profilo attuale",
      body: `${prettifyLevel(plan.performance.level)} · punti forti: ${plan.performance.strengths.join(", " )}.`,
    },
    {
      title: "Medie settimanali",
      body: `${formatDistance(avg.swimKm, "swim")} swim · ${formatDistance(avg.bikeKm, "bike")} bike · ${formatDistance(avg.runKm, "run")} run.`,
    },
    {
      title: "Vincoli atleta",
      body: `${plan.athlete.city || "Base non specificata"}${bmi ? ` · BMI ${bmi}` : ""}${plan.athlete.constraints ? ` · ${plan.athlete.constraints}` : ""}.`,
    },
  ];

  summaryCards.innerHTML = cards
    .map((card) => `
      <article class="summary-card">
        <h3>${card.title}</h3>
        <p>${card.body}</p>
      </article>
    `)
    .join("");
}

function renderCoachNote(plan) {
  const name = plan.athlete.fullName || "Atleta";
  const goal = plan.athlete.goalText || (plan.planConfig.planMode === "maintenance" ? "restare allenata con continuita'" : "arrivare pronta al via");
  const strongest = plan.performance.strengths[0];
  coachNote.innerHTML = `
    <p>
      <strong>Coach note per ${name}.</strong> Ho usato ${strongest} come base di sicurezza,
      ma il piano spinge soprattutto sulla disciplina meno solida e protegge gli orari reali.
      Gli allenamenti sono espressi in km, con tempo stimato e finestre concrete. Obiettivo guida:
      ${goal}.
    </p>
  `;
}

function renderWeekState() {
  if (!state.plan) {
    return;
  }

  const week = state.plan.weeks[state.currentWeekIndex];
  const totalWeeks = state.plan.weeks.length;
  cycleSummary.innerHTML = `
    <p>
      <strong>${week.phase.name} · ${week.variation.label}.</strong> ${week.phase.detail}
      ${state.plan.planConfig.planMode === "race" ? ` Mancano ${week.phase.weeksToRace} settimane alla gara.` : ` Settimana ${state.currentWeekIndex + 1} del ciclo rolling.`}
    </p>
  `;

  weekIndicator.innerHTML = `
    <strong>${week.label}</strong>
    <span>${state.currentWeekIndex + 1} / ${totalWeeks}</span>
    <span>${week.variation.label}</span>
  `;

  prevWeekButton.disabled = state.currentWeekIndex === 0;
  nextWeekButton.disabled = state.currentWeekIndex === totalWeeks - 1;

  renderWeek(week);
  renderRoutes(week);
  renderDeviceReadiness(state.plan);
}

function renderWeek(week) {
  const daySections = week.days
    .map((day) => {
      if (!day.sessions.length) {
        return `
          <section class="day-block">
            <div class="day-block-header">
              <div>
                <h4>${day.dayLabel} · ${day.dateLabel}</h4>
                <p>${day.workLabel}</p>
              </div>
              <span class="day-status rest">${day.available ? "Recupero / buffer" : "Non disponibile"}</span>
            </div>
            <p class="day-rest">${day.available ? "Giornata lasciata libera per recuperare, assorbire i carichi o gestire imprevisti." : "Nessun allenamento previsto per rispettare la disponibilita' inserita."}</p>
          </section>
        `;
      }

      const sessionCards = day.sessions
        .map((session) => `
          <button type="button" class="session-card" data-session-id="${session.id}">
            <div class="session-topline">
              <span class="session-day">${session.startTime} - ${session.endTime}</span>
              <span class="session-sport">${session.sport}</span>
            </div>
            <div>
              <h4>${session.title}</h4>
              <p>${session.shortDescription}</p>
            </div>
            <div class="session-meta">
              <span class="meta-pill">${formatDistance(session.distanceKm, session.sport)}</span>
              <span class="meta-pill">${formatDuration(session.estimatedMinutes)}</span>
              <span class="meta-pill">${session.paceCue}</span>
            </div>
            <span class="session-open">Apri specifico</span>
          </button>
        `)
        .join("");

      return `
        <section class="day-block">
          <div class="day-block-header">
            <div>
              <h4>${day.dayLabel} · ${day.dateLabel}</h4>
              <p>${day.workLabel}</p>
            </div>
            <span class="day-status">${day.sessions.length === 1 ? "1 sessione" : `${day.sessions.length} sessioni`}</span>
          </div>
          <div class="day-session-list">${sessionCards}</div>
        </section>
      `;
    })
    .join("");

  weeklyPlan.innerHTML = `
    <section class="week-card">
      <div class="week-header">
        <div>
          <h3>${week.label}</h3>
          <p>${week.startLabel} - ${week.endLabel} · ${week.phase.name} · ${week.variation.label}</p>
        </div>
        <span class="week-badge">${formatDistance(week.totals.swimKm, "swim")} swim · ${formatDistance(week.totals.bikeKm, "bike")} bike · ${formatDistance(week.totals.runKm, "run")} run</span>
      </div>
      <div class="day-sections">${daySections}</div>
    </section>
  `;
}

function renderRoutes(week) {
  const routeCards = buildWeekRoutes(week)
    .map((route) => `
      <article class="route-card">
        <h4>${route.title}</h4>
        <p>${route.body}</p>
      </article>
    `)
    .join("");

  routeSuggestions.innerHTML = routeCards || `
    <article class="route-card">
      <h4>Settimana senza lunghi specifici</h4>
      <p>Questa settimana e' piu' leggera o piu' orientata alla qualita'. Usa le schede dei singoli allenamenti per scegliere luogo e approccio.</p>
    </article>
  `;
}

function buildWeekRoutes(week) {
  return week.days
    .flatMap((day) => day.sessions)
    .filter((session) => session.longSession || session.type === "hills")
    .map((session) => {
      if (session.sport === "bike") {
        return {
          title: `${session.title} · ${session.dayLabel}`,
          body: `Route consigliata: ${formatDistance(session.distanceKm, "bike")} su percorso ${session.type === "hills" ? "con salita regolare o trainer in resistenza" : "scorrevole con poco traffico"}. Partenza ${session.startTime}, luce ${session.daylightLabel}. Porta fuel ogni 15-20 km.`,
        };
      }

      return {
        title: `${session.title} · ${session.dayLabel}`,
        body: `Route consigliata: ${formatDistance(session.distanceKm, "run")} su anello sicuro o out-and-back con acqua a meta'. Partenza ${session.startTime}, luce ${session.daylightLabel}. Tieni l'ultimo tratto regolare, non aggressivo.`,
      };
    });
}

function shiftWeek(direction) {
  if (!state.plan) {
    return;
  }
  state.currentWeekIndex = clamp(state.currentWeekIndex + direction, 0, state.plan.weeks.length - 1);
  renderWeekState();
}

function rebuildSessionLookup(plan) {
  state.sessionLookup = new Map();
  plan.weeks.forEach((week) => {
    week.days.forEach((day) => {
      day.sessions.forEach((session) => {
        state.sessionLookup.set(session.id, session);
      });
    });
  });
}

function openSessionModal(sessionId) {
  const session = state.sessionLookup.get(sessionId);
  if (!session) {
    return;
  }

  sessionDetail.innerHTML = `
    <div class="session-detail-card session-detail-header">
      <div class="session-topline">
        <span class="session-day">${session.dayLabel} · ${session.dateLabel} · ${session.startTime} - ${session.endTime}</span>
        <span class="session-sport">${session.sport}</span>
      </div>
      <div>
        <h3>${session.title}</h3>
        <p class="detail-copy">${session.shortDescription}</p>
      </div>
      <div class="detail-badges">
        <div class="detail-badge"><span>Distanza</span><strong>${formatDistance(session.distanceKm, session.sport)}</strong></div>
        <div class="detail-badge"><span>Tempo stimato</span><strong>${formatDuration(session.estimatedMinutes)}</strong></div>
        <div class="detail-badge"><span>Ritmo</span><strong>${session.paceCue}</strong></div>
        <div class="detail-badge"><span>Fase</span><strong>${session.phaseName}</strong></div>
      </div>
    </div>

    <div class="session-detail-card detail-grid">
      <div>
        <h3>Dove farlo</h3>
        <p class="detail-copy">${session.whereToGo}</p>
      </div>
      <div>
        <h3>Finestra oraria</h3>
        <p class="detail-copy">Allenamento previsto tra ${session.startTime} e ${session.endTime}. Finestra disponibile: ${session.windowLabel}. Luce utile: ${session.daylightLabel}.</p>
      </div>
    </div>

    <div class="session-detail-card">
      <h3>Specifico allenamento</h3>
      <ol class="detail-list">${session.structure.map((line) => `<li>${line}</li>`).join("")}</ol>
    </div>

    <div class="session-detail-card detail-grid">
      <div>
        <h3>Commenti coach</h3>
        <p class="detail-copy">${session.comments}</p>
      </div>
      <div>
        <h3>Come affrontarlo</h3>
        <p class="detail-copy">${session.approach}</p>
      </div>
    </div>
  `;

  sessionModal.classList.remove("hidden");
  sessionModal.setAttribute("aria-hidden", "false");
}

function closeSessionModal() {
  sessionModal.classList.add("hidden");
  sessionModal.setAttribute("aria-hidden", "true");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(window.location.protocol)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function bindInstallPromptEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    renderDeviceReadiness();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    showDeviceFeedback("App installata sul dispositivo. Da ora puoi usarla dalla schermata Home.");
    renderDeviceReadiness();
  });
}

function resolveInstallState() {
  if (isStandaloneDisplayMode()) {
    return {
      label: "App installata",
      disabled: true,
      hint: "Questa versione e' gia' attiva come app sul dispositivo.",
      actionHint: "L'app e' gia' installata.",
    };
  }

  if (window.location.protocol === "file:") {
    return {
      label: "Serve un link HTTPS",
      disabled: false,
      hint: "Da file locale il browser non puo' installarla: per il telefono serve aprirla da localhost o da un dominio HTTPS.",
      actionHint: "Per installarla sul telefono pubblica questa app su HTTPS oppure aprila da localhost durante lo sviluppo.",
    };
  }

  if (state.deferredInstallPrompt) {
    return {
      label: "Installa sul telefono",
      disabled: false,
      hint: "Sei in un browser compatibile: puoi installarla come app tascabile in pochi tocchi.",
      actionHint: "",
    };
  }

  if (isIosDevice()) {
    return {
      label: "Aggiungi alla Home",
      disabled: false,
      hint: "Su iPhone o iPad usa Condividi > Aggiungi alla schermata Home.",
      actionHint: "Su iPhone o iPad apri il menu Condividi di Safari e scegli 'Aggiungi alla schermata Home'.",
    };
  }

  return {
    label: "Aprila da telefono",
    disabled: false,
    hint: "Aprila da Chrome, Edge o Safari sul telefono per usarla come app e salvare i piani in locale.",
    actionHint: "Apri questa app da browser su telefono per installarla o aggiungerla alla Home.",
  };
}

async function handleInstallApp() {
  const installState = resolveInstallState();

  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    const choice = await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;

    if (choice?.outcome === "accepted") {
      showDeviceFeedback("Installazione avviata dal browser. Dopo il salvataggio la troverai come app sul telefono.");
    } else {
      showDeviceFeedback("Installazione annullata. Puoi riprovare quando vuoi.");
    }

    renderDeviceReadiness();
    return;
  }

  showDeviceFeedback(installState.actionHint);
}

function downloadGarminSyncDraft() {
  if (!state.plan) {
    showDeviceFeedback("Genera prima un piano, poi posso prepararti la bozza Garmin-ready.");
    return;
  }

  const draft = buildGarminSyncDraft(state.plan);
  downloadTextFile(buildGarminFileName(state.plan), JSON.stringify(draft, null, 2), "application/json");
  showDeviceFeedback("Bozza Garmin-ready scaricata. E' il payload di lavoro per il futuro backend di sync.");
}

function buildGarminSyncDraft(plan) {
  return {
    generatedAt: new Date().toISOString(),
    sourceApp: "Triathlon Planner",
    exportType: "garmin-sync-draft",
    athlete: {
      fullName: plan.athlete.fullName,
      focusDistance: plan.athlete.focusDistance,
      planMode: plan.planConfig.planMode,
      eventLabel: plan.planConfig.eventLabel,
      goalText: plan.athlete.goalText || null,
    },
    integrationNotes: {
      directSync: "Requires Garmin Connect Developer Program approval, OAuth 2.0, Training API and Courses API backend integration.",
      liveGuidance: "For tighter real-time wearable behavior, Garmin documents Garmin Health SDK options for enterprise partners.",
      currentWeekIndex: state.currentWeekIndex + 1,
    },
    weeks: plan.weeks.map((week) => buildGarminWeekDraft(week)),
  };
}

function buildGarminWeekDraft(week) {
  const sessions = flattenWeekSessions(week);

  return {
    weekIndex: week.weekIndex + 1,
    label: week.label,
    phase: week.phase.name,
    variation: week.variation.label,
    startDate: week.days[0]?.key || null,
    endDate: week.days.at(-1)?.key || null,
    totals: {
      swimKm: week.totals.swimKm,
      bikeKm: week.totals.bikeKm,
      runKm: week.totals.runKm,
      totalMinutes: week.totals.totalMinutes,
    },
    workouts: sessions.map((session) => ({
      externalId: session.id,
      sport: session.sport,
      workoutType: session.type,
      title: session.title,
      scheduledDate: formatDateInput(session.date),
      startTime: session.startTime,
      endTime: session.endTime,
      distanceKm: session.distanceKm,
      estimatedMinutes: session.estimatedMinutes,
      target: session.paceCue,
      environment: session.environment,
      locationHint: session.whereToGo,
      routeCandidate: Boolean(session.longSession || session.type === "hills"),
      window: session.windowLabel,
      daylight: session.daylightLabel,
      guidanceSteps: session.structure,
      coachComments: session.comments,
      executionNote: session.approach,
    })),
  };
}

function flattenWeekSessions(week) {
  if (!week) {
    return [];
  }
  return week.days.flatMap((day) => day.sessions);
}

function buildGarminFileName(plan) {
  const athleteName = sanitizeFileName((plan.athlete.fullName || "atleta").toLowerCase());
  return `${athleteName}-garmin-sync-draft.json`;
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "triathlon-planner";
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function showDeviceFeedback(message) {
  if (!deviceFeedback) {
    return;
  }

  deviceFeedback.textContent = message;
  if (state.deviceFeedbackTimeoutId) {
    window.clearTimeout(state.deviceFeedbackTimeoutId);
  }

  state.deviceFeedbackTimeoutId = window.setTimeout(() => {
    deviceFeedback.textContent = "";
  }, 4200);
}

function isStandaloneDisplayMode() {
  return Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function loadDemoData() {
  const demo = {
    fullName: "Anita Clivio",
    age: 34,
    sex: "female",
    heightCm: 170,
    weightKg: 62,
    city: "Milano",
    latitude: 45.4642,
    longitude: 9.19,
    swim400: "08:20",
    swim1500: "31:40",
    run5k: "24:40",
    run10k: "51:20",
    run21k: "01:54:00",
    run42k: "04:08:00",
    bike20k: "00:39:30",
    bike40k: "01:27:00",
    planMode: "race",
    focusDistance: "olympic",
    startMode: "today",
    startDate: formatDateInput(addDays(new Date(), 7)),
    eventName: "Triathlon Olimpico autunnale",
    raceDate: formatDateInput(addDays(new Date(), 84)),
    targetWeeklyHours: 8.5,
    goalText: "Arrivare solida in bici e correre bene l'ultimo 10 km",
    earliestTraining: "06:00",
    latestTraining: "21:00",
    constraints: "Piscina disponibile martedi' e giovedi'.",
  };

  Object.entries(demo).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  DAYS.forEach((day) => {
    form.elements.namedItem(`${day}-available`).checked = !["Friday"].includes(day);
    form.elements.namedItem(`${day}-work-start`).value = ["Saturday", "Sunday"].includes(day) ? "" : "09:00";
    form.elements.namedItem(`${day}-work-end`).value = ["Saturday", "Sunday"].includes(day) ? "" : "18:00";
    form.elements.namedItem(`${day}-preference`).value = "flexible";
  });

  form.elements.namedItem("Tuesday-preference").value = "early";
  form.elements.namedItem("Thursday-preference").value = "evening";
  form.elements.namedItem("Saturday-preference").value = "long";
  form.elements.namedItem("Sunday-preference").value = "long";
}

function useBrowserLocation() {
  if (!navigator.geolocation) {
    window.alert("Geolocalizzazione non supportata da questo browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.elements.namedItem("latitude").value = position.coords.latitude.toFixed(4);
      form.elements.namedItem("longitude").value = position.coords.longitude.toFixed(4);
    },
    () => {
      window.alert("Non sono riuscita a leggere la posizione. Inseriscila manualmente.");
    },
  );
}

function buildDayWindows(day, earliestTraining, latestTraining) {
  const windows = [];
  const earliest = timeToMinutes(earliestTraining);
  const latest = timeToMinutes(latestTraining);
  const workStart = day.workStart ? timeToMinutes(day.workStart) : null;
  const workEnd = day.workEnd ? timeToMinutes(day.workEnd) : null;

  if (workStart !== null && workStart - earliest >= 45) {
    windows.push({ start: minutesToTime(earliest), end: minutesToTime(workStart) });
  }

  if (workStart === null || workEnd === null) {
    windows.push({ start: minutesToTime(Math.max(earliest, 6 * 60 + 30)), end: minutesToTime(Math.min(latest, 11 * 60 + 30)) });
    if (latest - earliest >= 8 * 60) {
      windows.push({ start: minutesToTime(Math.max(earliest, 12 * 60 + 30)), end: minutesToTime(Math.min(latest, 14 * 60)) });
    }
    windows.push({ start: minutesToTime(Math.max(earliest, 17 * 60)), end: minutesToTime(latest) });
    return dedupeWindows(windows);
  }

  if (latest - workEnd >= 45) {
    windows.push({ start: minutesToTime(workEnd), end: minutesToTime(latest) });
  }

  return dedupeWindows(windows);
}

function chooseDaylightWindow(windows, daylight, sport) {
  if (!daylight || !["bike", "run"].includes(sport)) {
    return windows[0] || null;
  }

  const sunrise = timeToMinutes(daylight.sunrise);
  const sunset = timeToMinutes(daylight.sunset);

  return windows.find((window) => {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    return start >= sunrise && end <= sunset;
  }) || windows.find((window) => {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    return end > sunrise && start < sunset;
  }) || null;
}

function resolveEnvironment(sport, window, daylight) {
  if (sport === "swim") {
    return "Piscina";
  }

  const daylightWindow = daylight && ["bike", "run"].includes(sport)
    ? chooseDaylightWindow([window], daylight, sport)
    : null;

  if (sport === "bike") {
    return daylightWindow ? "Outdoor in luce" : "Trainer / commute protetto";
  }
  if (sport === "run") {
    return daylightWindow ? "Outdoor in luce" : "Tapis roulant o percorso illuminato";
  }
  return "Indoor";
}

function calculateSunTimes(date, latitude, longitude) {
  const timezoneOffset = -date.getTimezoneOffset() / 60;
  const sunrise = calculateSunTime(date, latitude, longitude, true, timezoneOffset);
  const sunset = calculateSunTime(date, latitude, longitude, false, timezoneOffset);

  if (!sunrise || !sunset) {
    return null;
  }

  return { sunrise, sunset };
}

function calculateSunTime(date, latitude, longitude, isSunrise, timezoneOffset) {
  const dayOfYear = getDayOfYear(date);
  const lngHour = longitude / 15;
  const approximateTime = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const meanAnomaly = (0.9856 * approximateTime) - 3.289;
  let trueLongitude = meanAnomaly
    + 1.916 * Math.sin(degToRad(meanAnomaly))
    + 0.02 * Math.sin(degToRad(2 * meanAnomaly))
    + 282.634;
  trueLongitude = normalizeDegrees(trueLongitude);

  let rightAscension = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(trueLongitude))));
  rightAscension = normalizeDegrees(rightAscension);
  const longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
  const raQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = (rightAscension + (longitudeQuadrant - raQuadrant)) / 15;

  const sinDeclination = 0.39782 * Math.sin(degToRad(trueLongitude));
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosLocalHour = (Math.cos(degToRad(90.833)) - (sinDeclination * Math.sin(degToRad(latitude)))) / (cosDeclination * Math.cos(degToRad(latitude)));

  if (cosLocalHour > 1 || cosLocalHour < -1) {
    return null;
  }

  let localHourAngle = isSunrise
    ? 360 - radToDeg(Math.acos(cosLocalHour))
    : radToDeg(Math.acos(cosLocalHour));
  localHourAngle /= 15;

  const localMeanTime = localHourAngle + rightAscension - (0.06571 * approximateTime) - 6.622;
  const universalTime = normalizeHours(localMeanTime - lngHour);
  const localTime = normalizeHours(universalTime + timezoneOffset);

  return minutesToTime(Math.round(localTime * 60));
}

function resolvePaceCue(sport, type, performance) {
  if (sport === "run") {
    const pace10k = performance.runRefs.pace10k || performance.runPace;
    const paceHalf = performance.runRefs.pace21k || (pace10k + 0.18);
    const paceMar = performance.runRefs.pace42k || (paceHalf + 0.18);
    const easyStart = paceHalf + 0.25;

    if (type === "easy") return `${formatPaceRange(easyStart, easyStart + 0.18)} / km`;
    if (type === "tempo") return `${formatPaceRange(paceHalf - 0.02, pace10k + 0.05)} / km`;
    if (type === "speed") return `${formatPaceRange(pace10k - 0.12, pace10k - 0.04)} / km`;
    if (type === "block") return `${formatPace(easyStart)} -> ${formatPace(paceHalf)} / km`;
    if (type === "long") return `${formatPaceRange(paceMar + 0.06, paceMar + 0.2)} / km`;
    if (type === "brick") return `${formatPaceRange(paceHalf + 0.18, paceHalf + 0.32)} / km`;
  }

  if (sport === "bike") {
    const base = performance.bikeRefs.speed40k || performance.bikeSpeed;
    if (type === "recovery") return `${(base - 7).toFixed(1)} - ${(base - 5).toFixed(1)} km/h`;
    if (type === "tempo") return `${(base - 2).toFixed(1)} - ${(base + 0.5).toFixed(1)} km/h`;
    if (type === "threshold") return `${(base + 0.8).toFixed(1)} - ${(base + 2.4).toFixed(1)} km/h`;
    if (type === "hills") return `${(base + 1.5).toFixed(1)} - ${(base + 3.5).toFixed(1)} km/h nei tratti forti`;
    if (type === "long") return `${(base - 4).toFixed(1)} - ${(base - 1.5).toFixed(1)} km/h`;
    if (type === "brick") return `${(base - 3).toFixed(1)} - ${(base - 1).toFixed(1)} km/h`;
  }

  const base = performance.swimRefs.pace1500 || performance.swimPace;
  if (type === "technique") return `${formatPace(base + 0.12)} - ${formatPace(base + 0.18)} / 100m`;
  if (type === "aerobic") return `${formatPace(base + 0.06)} - ${formatPace(base + 0.1)} / 100m`;
  if (type === "threshold") return `${formatPace(base)} - ${formatPace(base + 0.03)} / 100m`;
  if (type === "speed") return `${formatPace(base - 0.05)} - ${formatPace(base)} / 100m`;
  return `${formatPace(base + 0.04)} - ${formatPace(base + 0.08)} / 100m`;
}

function buildWorkoutStructure(sport, type, distanceKm, performance, weekVariation) {
  if (sport === "run") {
    return buildRunStructure(type, distanceKm, performance, weekVariation);
  }
  if (sport === "bike") {
    return buildBikeStructure(type, distanceKm, performance, weekVariation);
  }
  return buildSwimStructure(type, distanceKm, performance, weekVariation);
}

function buildRunStructure(type, distanceKm, performance, weekVariation) {
  const variationIndex = weekVariation.structureIndex % 4;
  const pace10k = performance.runRefs.pace10k || performance.runPace;
  const paceHalf = performance.runRefs.pace21k || (pace10k + 0.18);
  const paceMar = performance.runRefs.pace42k || (paceHalf + 0.18);
  const easyMin = paceHalf + 0.25;
  const easyMax = easyMin + 0.18;
  const warm = roundDistanceForSport("run", Math.min(2.5, Math.max(1.5, distanceKm * 0.2)));
  const cool = roundDistanceForSport("run", Math.min(2, Math.max(1, distanceKm * 0.15)));
  const main = roundDistanceForSport("run", Math.max(0.5, distanceKm - warm - cool));

  if (type === "easy") {
    const finishFast = roundDistanceForSport("run", Math.max(0.5, main * 0.2));
    return [
      `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + mobilita' di caviglie e anche`,
      `${formatDistance(Math.max(0.5, main - (variationIndex === 2 ? finishFast : 0)), "run")} continui @ ${formatPaceRange(easyMin, easyMax)} / km`,
      variationIndex === 1
        ? `4 x 0.15 km di allungo @ ${formatPaceRange(pace10k - 0.08, pace10k - 0.02)} / km con recupero camminando`
        : variationIndex === 2
          ? `${formatDistance(finishFast, "run")} finali steady @ ${formatPaceRange(paceHalf + 0.12, paceHalf + 0.18)} / km`
          : `Chiudi in controllo nello stesso passo facile @ ${formatPaceRange(easyMin, easyMax)} / km`,
      `${formatDistance(cool, "run")} di defaticamento @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km`,
    ];
  }

  if (type === "tempo") {
    const recoveryKm = 0.5;
    if (variationIndex === 0) {
      const repKms = buildRepeatDistances(main - (recoveryKm * 2), 3, "run", 1.5);
      const targetPaces = [paceHalf + 0.04, paceHalf, pace10k + 0.05];
      return [
        `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + attivazione`,
        ...targetPaces.map((pace, index) => `${formatDistance(repKms[index], "run")} intervallo ${index + 1} @ ${formatPace(pace)} / km`),
        `2 x ${formatDistance(recoveryKm, "run")} jog di recupero @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.12)} / km tra intervallo 1-2 e 2-3`,
        `${formatDistance(cool, "run")} facili @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km per chiudere`,
      ];
    }
    if (variationIndex === 1) {
      const repKms = buildRepeatDistances(main - recoveryKm, 2, "run", 2);
      const targetPaces = [paceHalf - 0.02, pace10k + 0.02];
      return [
        `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + 3 allunghi`,
        ...targetPaces.map((pace, index) => `${formatDistance(repKms[index], "run")} intervallo ${index + 1} @ ${formatPace(pace)} / km`),
        `${formatDistance(recoveryKm, "run")} jog @ ${formatPaceRange(easyMin + 0.1, easyMax + 0.15)} / km tra intervallo 1 e 2`,
        `${formatDistance(cool, "run")} di defaticamento @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km`,
      ];
    }
    if (variationIndex === 2) {
      const shortRecoveryKm = 0.3;
      const repKms = buildRepeatDistances(main - (shortRecoveryKm * 3), 4, "run", 1);
      const paces = [paceHalf, paceHalf - 0.03, pace10k + 0.08, pace10k + 0.03];
      return [
        `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + drills corsa`,
        ...paces.map((pace, index) => `${formatDistance(repKms[index], "run")} intervallo ${index + 1} @ ${formatPace(pace)} / km`),
        `3 x ${formatDistance(shortRecoveryKm, "run")} jog @ ${formatPaceRange(easyMin + 0.12, easyMax + 0.18)} / km tra ogni intervallo`,
        `${formatDistance(cool, "run")} facili @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km in chiusura`,
      ];
    }
    const repKms = buildRepeatDistances(main - recoveryKm, 2, "run", 1.5);
    const targetPaces = [paceHalf + 0.1, paceHalf + 0.02];
    return [
      `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km`,
      ...targetPaces.map((pace, index) => `${formatDistance(repKms[index], "run")} intervallo ${index + 1} @ ${formatPace(pace)} / km`),
      `${formatDistance(recoveryKm, "run")} jog molto facile @ ${formatPaceRange(easyMin + 0.12, easyMax + 0.2)} / km tra intervallo 1 e 2`,
      `${formatDistance(cool, "run")} tranquille @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km per lasciare gamba fresca`,
    ];
  }

  if (type === "speed") {
    const repKm = [0.4, 0.5, 0.3, 0.4][variationIndex];
    const reps = [8, 6, 10, 6][variationIndex];
    return [
      `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + drills + 4 allunghi`,
      `${reps} x ${formatDistance(repKm, "run")} @ ${formatPaceRange(pace10k - 0.14, pace10k - 0.05)} / km`,
      `${formatDistance(repKm / 2, "run")} jog @ ${formatPaceRange(easyMin + 0.12, easyMax + 0.2)} / km tra le prove`,
      `${formatDistance(cool, "run")} facili @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km in chiusura`,
    ];
  }

  if (type === "block") {
    const blockKm = splitDistanceEvenly(main, 3, "run", 1.5);
    const extraBlock = variationIndex === 2 ? splitDistanceEvenly(main, 4, "run", 1.5) : null;
    if (extraBlock) {
      return [
        `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + attivazione`,
        `${formatDistance(extraBlock, "run")} @ ${formatPaceRange(easyMin, easyMax)} / km`,
        `${formatDistance(extraBlock, "run")} @ ${formatPaceRange(paceHalf + 0.16, paceHalf + 0.24)} / km`,
        `${formatDistance(extraBlock, "run")} @ ${formatPaceRange(paceHalf + 0.04, paceHalf + 0.1)} / km`,
        `${formatDistance(extraBlock, "run")} @ ${formatPaceRange(pace10k + 0.02, pace10k + 0.08)} / km`,
        `${formatDistance(cool, "run")} di ritorno @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km`,
      ];
    }
    return [
      `${formatDistance(warm, "run")} easy @ ${formatPaceRange(easyMin + 0.08, easyMax + 0.14)} / km + mobilita'`,
      `${formatDistance(blockKm, "run")} blocco 1 @ ${formatPaceRange(easyMin, easyMax)} / km`,
      `${formatDistance(blockKm, "run")} blocco 2 @ ${formatPaceRange(paceHalf + 0.12, paceHalf + 0.2)} / km`,
      `${formatDistance(blockKm, "run")} blocco 3 @ ${formatPaceRange(pace10k + 0.03, pace10k + 0.1)} / km`,
      `${formatDistance(cool, "run")} di ritorno @ ${formatPaceRange(easyMin + 0.14, easyMax + 0.22)} / km`,
    ];
  }

  if (type === "brick") {
    const firstKm = roundDistanceForSport("run", Math.min(1.5, Math.max(1, distanceKm * 0.3)));
    const remainingKm = roundDistanceForSport("run", Math.max(0.5, distanceKm - firstKm));
    return [
      `Scendi dalla bici e parti subito, senza inseguire il passo`,
      `${formatDistance(firstKm, "run")} iniziali @ ${formatPaceRange(easyMin, easyMax)} / km`,
      `${formatDistance(remainingKm, "run")} successivi @ ${formatPaceRange(paceHalf + 0.16, paceHalf + 0.28)} / km`,
      `Chiudi con 3-5 minuti di camminata e reset`,
    ];
  }

  const openingKm = roundDistanceForSport("run", Math.max(2, distanceKm * 0.6));
  const middleKm = roundDistanceForSport("run", Math.max(1, distanceKm * 0.25));
  const closingKm = roundDistanceForSport("run", Math.max(1, distanceKm - openingKm - middleKm));
  return [
    `${formatDistance(openingKm, "run")} iniziali @ ${formatPaceRange(paceMar + 0.12, paceMar + 0.24)} / km`,
    `${formatDistance(middleKm, "run")} centrali @ ${formatPaceRange(paceMar + 0.04, paceMar + 0.12)} / km`,
    `${formatDistance(closingKm, "run")} finali @ ${formatPaceRange(paceHalf + 0.18, paceHalf + 0.28)} / km se la gamba e' buona`,
    `Gestisci nutrizione e idratazione come test gara`,
  ];
}

function buildBikeStructure(type, distanceKm, performance, weekVariation) {
  const variationIndex = weekVariation.structureIndex % 4;
  const base = performance.bikeRefs.speed40k || performance.bikeSpeed;
  const warm = roundDistanceForSport("bike", Math.max(8, distanceKm * 0.18));
  const cool = roundDistanceForSport("bike", Math.max(6, distanceKm * 0.12));
  const main = roundDistanceForSport("bike", Math.max(8, distanceKm - warm - cool));

  if (type === "recovery") {
    return [
      `${formatDistance(distanceKm, "bike")} continui @ ${formatSpeedRange(base - 7, base - 5)} km/h`,
      `Cadenza sciolta, niente spinta dura, chiudi piu' fresca di come parti`,
    ];
  }

  if (type === "tempo") {
    const reps = variationIndex === 2 ? 3 : 2;
    const recoveryKm = 4;
    const repKm = resolveRepeatDistance(main, reps, "bike", 6, recoveryKm, reps - 1);
    return [
      `${formatDistance(warm, "bike")} easy di avvio`,
      `${reps} x ${formatDistance(repKm, "bike")} @ ${formatSpeedRange(base - 2, base + 0.8)} km/h`,
      `${reps - 1} x ${formatDistance(recoveryKm, "bike")} agili tra i blocchi @ ${formatSpeedRange(base - 7, base - 5)} km/h`,
      `${formatDistance(cool, "bike")} molto agili in chiusura`,
    ];
  }

  if (type === "threshold") {
    const reps = variationIndex === 1 ? 3 : 4;
    const recoveryKm = 3;
    const repKm = resolveRepeatDistance(main, reps, "bike", 4, recoveryKm, reps - 1);
    return [
      `${formatDistance(warm, "bike")} progressive di riscaldamento`,
      `${reps} x ${formatDistance(repKm, "bike")} @ ${formatSpeedRange(base + 1, base + 2.6)} km/h`,
      `${reps - 1} x ${formatDistance(recoveryKm, "bike")} easy @ ${formatSpeedRange(base - 7, base - 5)} km/h tra i blocchi`,
      `${formatDistance(cool, "bike")} easy finali`,
    ];
  }

  if (type === "hills") {
    const reps = [5, 6, 4, 4][variationIndex];
    const recoveryKm = 2;
    const repKm = resolveRepeatDistance(main, reps, "bike", 2, recoveryKm, reps - 1);
    return [
      `${formatDistance(warm, "bike")} easy di attivazione`,
      `${reps} x ${formatDistance(repKm, "bike")} in salita / resistenza alta @ ${formatSpeedRange(base + 0.8, base + 2.8)} km/h equivalenti`,
      `${reps - 1} x ${formatDistance(recoveryKm, "bike")} agile in recupero tra le salite`,
      `${formatDistance(cool, "bike")} sciolti per chiudere`,
    ];
  }

  if (type === "brick") {
    const transitionKm = roundDistanceForSport("bike", Math.max(4, distanceKm * 0.18));
    return [
      `${formatDistance(warm, "bike")} facili`,
      `${formatDistance(Math.max(6, main - transitionKm), "bike")} centrali @ ${formatSpeedRange(base - 2.5, base - 0.5)} km/h`,
      `${formatDistance(transitionKm, "bike")} finali a cadenza alta @ ${formatSpeedRange(base - 3.5, base - 1.5)} km/h`,
      `${formatDistance(cool, "bike")} easy e prepara il cambio scarpe`,
    ];
  }

  const firstKm = roundDistanceForSport("bike", Math.max(18, distanceKm * 0.45));
  const middleKm = roundDistanceForSport("bike", Math.max(12, distanceKm * 0.35));
  const finalKm = roundDistanceForSport("bike", Math.max(8, distanceKm - firstKm - middleKm));
  return [
    `${formatDistance(firstKm, "bike")} iniziali @ ${formatSpeedRange(base - 4, base - 2.5)} km/h`,
    `${formatDistance(middleKm, "bike")} centrali @ ${formatSpeedRange(base - 2.5, base - 1)} km/h`,
    `${formatDistance(finalKm, "bike")} finali @ ${formatSpeedRange(base - 2, base - 0.5)} km/h se resti composta`,
    `Fuel ogni 15-20 km e postura stabile`,
  ];
}

function buildSwimStructure(type, distanceKm, performance, weekVariation) {
  const variationIndex = weekVariation.structureIndex % 4;
  const base = performance.swimRefs.pace1500 || performance.swimPace;
  const warm = roundDistanceForSport("swim", Math.max(0.4, distanceKm * 0.2));
  const cool = roundDistanceForSport("swim", Math.max(0.3, distanceKm * 0.15));
  const main = roundDistanceForSport("swim", Math.max(0.4, distanceKm - warm - cool));

  if (type === "technique") {
    const rep = splitDistanceEvenly(main, 4, "swim", 0.1);
    return [
      `${formatDistance(warm, "swim")} facili di ingresso acqua`,
      `4 x ${formatDistance(rep, "swim")} drill / stile @ ${formatPaceRange(base + 0.12, base + 0.18)} / 100m`,
      `${formatDistance(cool, "swim")} sciolti con tecnica pulita`,
    ];
  }
  if (type === "aerobic") {
    const rep = splitDistanceEvenly(main, variationIndex === 2 ? 5 : 4, "swim", 0.2);
    const reps = variationIndex === 2 ? 5 : 4;
    return [
      `${formatDistance(warm, "swim")} easy`,
      `${reps} x ${formatDistance(rep, "swim")} @ ${formatPaceRange(base + 0.06, base + 0.1)} / 100m`,
      `${formatDistance(cool, "swim")} di defaticamento`,
    ];
  }
  if (type === "threshold") {
    const rep = splitDistanceEvenly(main, 4, "swim", 0.2);
    return [
      `${formatDistance(warm, "swim")} progressive`,
      `4 x ${formatDistance(rep, "swim")} @ ${formatPaceRange(base, base + 0.03)} / 100m`,
      `${formatDistance(cool, "swim")} facili finali`,
    ];
  }
  if (type === "speed") {
    const rep = splitDistanceEvenly(main, 6, "swim", 0.1);
    return [
      `${formatDistance(warm, "swim")} facili + attivazione`,
      `6 x ${formatDistance(rep, "swim")} @ ${formatPaceRange(base - 0.05, base)} / 100m con recupero pieno`,
      `${formatDistance(cool, "swim")} sciolti`,
    ];
  }
  const rep = splitDistanceEvenly(main, 3, "swim", 0.3);
  return [
    `${formatDistance(warm, "swim")} easy`,
    `3 x ${formatDistance(rep, "swim")} @ ${formatPaceRange(base + 0.04, base + 0.08)} / 100m`,
    `${formatDistance(cool, "swim")} leggeri in uscita`,
  ];
}

function splitDistanceEvenly(totalKm, count, sport, minChunk) {
  const raw = totalKm / count;
  const rounded = roundDistanceForSport(sport, Math.max(minChunk, raw));
  return Math.max(minChunk, rounded);
}

function resolveRepeatDistance(totalKm, count, sport, minChunk, recoveryKm = 0, recoveryRepeats = Math.max(0, count - 1)) {
  const workKm = Math.max(minChunk * count, totalKm - (recoveryKm * recoveryRepeats));
  return splitDistanceEvenly(workKm, count, sport, minChunk);
}

function buildRepeatDistances(totalKm, count, sport, minChunk) {
  const step = sport === "swim" ? 0.1 : (sport === "run" ? 0.5 : 1);
  const targetTotal = Math.max(minChunk * count, totalKm);
  const chunks = Array.from({ length: count }, () => minChunk);
  let remaining = targetTotal - (minChunk * count);
  let index = 0;

  while (remaining >= step - 1e-9) {
    chunks[index % count] = roundDistanceForSport(sport, chunks[index % count] + step);
    remaining -= step;
    index += 1;
  }

  return chunks;
}

function formatPaceRange(first, second) {
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  if (Math.abs(high - low) < 0.03) {
    return formatPace((high + low) / 2);
  }
  return `${formatPace(low)} - ${formatPace(high)}`;
}

function formatSpeedRange(first, second) {
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  if (Math.abs(high - low) < 0.25) {
    return ((high + low) / 2).toFixed(1);
  }
  return `${low.toFixed(1)} - ${high.toFixed(1)}`;
}


function resolveLocationHint(sport, type, city, environment, distanceKm) {
  const place = city || "la tua zona";

  if (sport === "swim") {
    return `Piscina a ${place}, preferibilmente corsia tranquilla. Cerca vasca 25m o 50m con spazio per chiudere ${formatDistance(distanceKm, "swim")} senza soste lunghe.`;
  }
  if (sport === "run" && type === "speed") {
    return `Vai su pista, rettilineo piatto o ciclabile regolare a ${place}. Servono appoggi puliti e zero interruzioni.`;
  }
  if (sport === "run" && type === "long") {
    return `Percorso sicuro a ${place}: meglio anello o out-and-back con acqua intorno a meta' seduta. ${environment}.`;
  }
  if (sport === "run") {
    return `Percorso regolare a ${place}, facile da controllare come ritmo e senza troppi semafori. ${environment}.`;
  }
  if (sport === "bike" && type === "hills") {
    return `Salita regolare vicino a ${place} oppure trainer con resistenza impostabile. Serve continuita' piu' che traffico.`;
  }
  if (sport === "bike" && type === "long") {
    return `Route lunga attorno a ${place} con poco traffico, rientro semplice e punti acqua/bar. ${environment}.`;
  }
  return `Percorso scorrevole o indoor trainer vicino a ${place}. ${environment}.`;
}

function buildCoachComment(sport, type, phase, shortened, weekVariation) {
  const trimmedNote = shortened ? " Ho accorciato un po' il volume per farlo stare davvero nella finestra disponibile." : "";
  const focusNote = ` Focus settimana: ${weekVariation.label}.`;

  if (sport === "run" && type === "block") {
    return `Seduta utile per insegnarti a cambiare marcia senza strappare. Cerca fluidita' nei passaggi di ritmo.${focusNote}${trimmedNote}`;
  }
  if (sport === "run" && type === "tempo") {
    return `Qui conta tenere il ritmo giusto su ogni blocco, non correre sempre piu' forte. Leggi bene i passi di ogni intervallo.${focusNote}${trimmedNote}`;
  }
  if (sport === "bike" && type === "long") {
    return `Qui alleni resistenza, posizione e nutrizione. La vittoria e' finire regolare, non fare numeri a meta'.${focusNote}${trimmedNote}`;
  }
  if (sport === "swim" && type === "threshold") {
    return `Conta la qualita' della nuotata, non solo il cronometro. Bracciata compatta e respirazione sotto controllo.${focusNote}${trimmedNote}`;
  }
  return `Allenamento inserito in fase ${phase.name.toLowerCase()} per farti assorbire il carico e progredire senza stress inutile.${focusNote}${trimmedNote}`;
}

function buildApproachNote(sport, type, longSession) {
  if (longSession) {
    return "Parti conservativa, controlla i primi minuti e costruisci la seduta. Mangia e bevi prima di arrivare vuota.";
  }
  if (sport === "run" && type === "speed") {
    return "Pensa a reattivita' e tecnica, non ad andare rigida. Se il passo scappa, riduci e torna pulita.";
  }
  if (sport === "bike" && type === "threshold") {
    return "Siediti bene sulla bici, spingi tonda e non trasformare ogni ripetuta in all-out.";
  }
  if (sport === "swim" && type === "technique") {
    return "Cura la forma prima del volume: ogni vasca deve sembrare ordinata, non trascinata.";
  }
  return "Rimani disciplinata, esegui il compito e chiudi con la sensazione di poter rifare un altro blocco con controllo.";
}

function estimateMinutesForDistance(sport, type, distanceKm, performance) {
  if (sport === "swim") {
    const factor = { technique: 1.08, aerobic: 1.05, threshold: 1, speed: 0.96, endurance: 1.04 }[type] || 1;
    return Math.round(distanceKm * 10 * performance.swimPace * factor);
  }

  if (sport === "run") {
    const factor = { easy: 1.09, tempo: 0.98, speed: 0.92, block: 1.02, long: 1.07, brick: 1.12 }[type] || 1;
    return Math.round(distanceKm * performance.runPace * factor);
  }

  const speedFactor = { recovery: 0.78, tempo: 0.96, threshold: 1.04, hills: 0.92, long: 0.86, brick: 0.9 }[type] || 0.9;
  const effectiveSpeed = Math.max(18, performance.bikeSpeed * speedFactor);
  return Math.round((distanceKm / effectiveSpeed) * 60);
}

function averageWeekTotals(weeks) {
  return {
    swimKm: roundDistanceForSport("swim", average(weeks.map((week) => week.totals.swimKm))),
    bikeKm: roundDistanceForSport("bike", average(weeks.map((week) => week.totals.bikeKm))),
    runKm: roundDistanceForSport("run", average(weeks.map((week) => week.totals.runKm))),
  };
}

function sortByPreference(days, order) {
  return [...days].sort((left, right) => {
    const leftScore = order.indexOf(left.preference);
    const rightScore = order.indexOf(right.preference);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return right.longestWindowMinutes - left.longestWindowMinutes;
  });
}

function preferenceScore(preference) {
  return { long: 0, flexible: 1, early: 2, evening: 3 }[preference] ?? 4;
}

function weekendScore(dayName) {
  return ["Saturday", "Sunday"].includes(dayName) ? 1 : 0;
}

function parseDurationToMinutes(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":").map(Number);
  if (parts.some(Number.isNaN)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes + (seconds / 60);
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 60) + minutes + (seconds / 60);
  }

  return null;
}

function scoreFromThresholds(value, thresholds, lowerIsBetter) {
  if (lowerIsBetter) {
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 4;
    return 5;
  }

  if (value >= thresholds[0]) return 1;
  if (value >= thresholds[1]) return 2;
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[3]) return 4;
  return 5;
}

function resolveLevel(score) {
  if (score <= 1.6) return "competitive";
  if (score <= 2.35) return "solid";
  if (score <= 3.1) return "developing";
  return "novice";
}

function prettifyLevel(level) {
  return {
    competitive: "Competitive",
    solid: "Solid",
    developing: "Developing",
    novice: "Novice",
  }[level];
}

function rankStrengths(scores) {
  const labels = { swimScore: "nuoto", bikeScore: "bici", runScore: "corsa" };
  return Object.entries(scores)
    .sort((left, right) => left[1] - right[1])
    .map(([key]) => labels[key]);
}

function parseDateLocal(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date) {
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function formatMediumDate(date) {
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "short" });
}

function formatShortDate(date) {
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function diffWeekBlocks(startDate, endDate) {
  return Math.max(1, Math.floor(diffDays(startDate, endDate) / 7) + 1);
}

function diffDays(startDate, endDate) {
  const start = parseDateLocal(formatDateInput(startDate));
  const end = parseDateLocal(formatDateInput(endDate));
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDate(left, right) {
  return formatDateInput(left) === formatDateInput(right);
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function addMinutesToTime(time, minutesToAdd) {
  return minutesToTime(timeToMinutes(time) + minutesToAdd);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDistance(distanceKm, sport) {
  const digits = sport === "swim" ? 1 : (sport === "run" ? 1 : 0);
  return `${distanceKm.toFixed(digits).replace(".0", "")} km`;
}

function roundDistanceForSport(sport, distanceKm) {
  const step = sport === "swim" ? 0.1 : (sport === "run" ? 0.5 : 1);
  return Math.max(step, Math.round(distanceKm / step) * step);
}

function formatDuration(totalMinutes) {
  const rounded = Math.max(15, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!hours) {
    return `${minutes} min`;
  }
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

function formatPace(minutes) {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${wholeMinutes}:${seconds}`;
}

function minutesToSwimKm(minutes, pacePer100m) {
  return minutes * 0.1 / pacePer100m;
}

function minutesToRunKm(minutes, pacePerKm) {
  return minutes / pacePerKm;
}

function minutesToBikeKm(minutes, bikeSpeedKmH) {
  return minutes * bikeSpeedKmH / 60;
}

function roundToHalfHour(hours) {
  return Math.round(hours * 2) / 2;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dedupeWindows(windows) {
  return windows.filter((window, index, array) => (
    window.start
    && window.end
    && timeToMinutes(window.end) > timeToMinutes(window.start)
    && array.findIndex((item) => item.start === window.start && item.end === window.end) === index
  ));
}

function windowDuration(window) {
  return timeToMinutes(window.end) - timeToMinutes(window.start);
}

function degToRad(value) {
  return value * (Math.PI / 180);
}

function radToDeg(value) {
  return value * (180 / Math.PI);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function normalizeHours(value) {
  return ((value % 24) + 24) % 24;
}

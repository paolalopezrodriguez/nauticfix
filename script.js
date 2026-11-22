const STORAGE_KEYS = {
  draft: "nauticfix.pendingBooking",
  appointment: "nauticfix.appointment",
  appointments: "nauticfix.appointments",
  profile: "nauticfix.profile",
  supportRequests: "nauticfix.supportRequests"
};

function readStoredData(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`No se pudo leer el dato local "${key}".`, error);
    window.alert("No se pudieron leer los datos guardados. Intenta completar el formulario nuevamente.");
    return null;
  }
}

function saveStoredData(key, value, statusElement) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`No se pudo guardar el dato local "${key}".`, error);
    if (statusElement) {
      statusElement.textContent = "No se pudieron guardar los datos. Inténtalo nuevamente.";
      statusElement.setAttribute("role", "alert");
    } else {
      window.alert("No se pudieron guardar los datos. Inténtalo nuevamente.");
    }
    return false;
  }
}

function formatDate(dateString) {
  if (!dateString) return "Sin fecha seleccionada";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PR", { dateStyle: "long" }).format(date);
}

function getStoredAppointments() {
  const appointments = readStoredData(STORAGE_KEYS.appointments);
  if (Array.isArray(appointments)) {
    return appointments.filter((appointment) =>
      appointment && typeof appointment === "object" && typeof appointment.reference === "string"
    );
  }

  const legacyAppointment = readStoredData(STORAGE_KEYS.appointment);
  return legacyAppointment && typeof legacyAppointment.reference === "string"
    ? [legacyAppointment]
    : [];
}

function getLatestAppointment() {
  const appointments = getStoredAppointments();
  return appointments.length ? appointments[appointments.length - 1] : null;
}

function getFormValue(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function setupServiceForm() {
  const form = document.getElementById("serviceForm");
  if (!form) return;

  const serviceSelect = document.getElementById("service");
  const customField = document.getElementById("customServiceField");
  const customInput = document.getElementById("customService");
  const locationSelect = document.getElementById("serviceLocation");
  const otherLocationField = document.getElementById("otherLocationField");
  const otherLocationInput = document.getElementById("otherLocation");

  serviceSelect.addEventListener("change", () => {
    const isCustom = serviceSelect.value === "Personalizado";
    customField.hidden = !isCustom;
    customInput.required = isCustom;
  });

  locationSelect.addEventListener("change", () => {
    const isOtherLocation = locationSelect.value === "Otra";
    otherLocationField.hidden = !isOtherLocation;
    otherLocationInput.required = isOtherLocation;
  });

  const requestedService = new URLSearchParams(window.location.search).get("servicio");
  const serviceOptions = {
    motor: "Motor",
    electricidad: "Electricidad",
    casco: "Casco",
    cubierta: "Cubierta",
    limpieza: "Limpieza",
    personalizado: "Personalizado"
  };
  if (requestedService && serviceOptions[requestedService.toLowerCase()]) {
    serviceSelect.value = serviceOptions[requestedService.toLowerCase()];
    serviceSelect.dispatchEvent(new Event("change"));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const booking = {
      service: getFormValue(formData, "service"),
      customService: getFormValue(formData, "customService"),
      boat: getFormValue(formData, "boat"),
      issue: getFormValue(formData, "issue"),
      customerName: getFormValue(formData, "customerName"),
      email: getFormValue(formData, "email"),
      phone: getFormValue(formData, "phone"),
      workType: getFormValue(formData, "workType"),
      serviceLocation: getFormValue(formData, "serviceLocation"),
      otherLocation: getFormValue(formData, "otherLocation")
    };

    if (saveStoredData(STORAGE_KEYS.draft, booking, document.getElementById("serviceMessage"))) {
      window.location.href = "page2.html";
    }
  });
}

function getInspectionPrice(booking) {
  if (booking.workType !== "Inspección") return "No aplica; solicita una cotización del trabajo.";
  if (booking.serviceLocation === "Marina") return "$0.00 dentro de marina.";
  if (booking.serviceLocation === "Fajardo") return "$100.00 en Fajardo, fuera de marina.";
  return `Cotización según la distancia${booking.otherLocation ? ` para ${booking.otherLocation}` : ""}.`;
}

function createAppointmentTimeline(createdAt) {
  const stages = [
    ["Diagnóstico", "El taller documentará la inspección y los hallazgos."],
    ["En reparación", "El progreso de la reparación se actualizará aquí."],
    ["Control de calidad", "El taller registrará la revisión final del trabajo."],
    ["Lista para entrega", "El taller actualizará esta etapa cuando la embarcación esté lista."]
  ];
  return stages.map(([title, detail], index) => ({
    title,
    date: index === 0 && typeof createdAt === "string" ? createdAt : "",
    time: "",
    status: "Pendiente",
    detail: index === 0 ? "Solicitud recibida; diagnóstico pendiente." : detail,
    image: "",
    imageAlt: "",
    imageLabel: "",
    evidence: []
  }));
}

function setupAppointmentForm() {
  const form = document.getElementById("appointmentForm");
  if (!form) return;

  const savedBooking = readStoredData(STORAGE_KEYS.draft);
  const booking = savedBooking &&
    typeof savedBooking === "object" &&
    typeof savedBooking.service === "string" &&
    typeof savedBooking.boat === "string" &&
    typeof savedBooking.issue === "string"
    ? savedBooking
    : null;
  const submitButton = document.getElementById("confirmAppointment");
  const message = document.getElementById("appointmentMessage");
  const dateInput = document.getElementById("appointmentDate");
  const timeSelect = document.getElementById("appointmentTime");
  const today = new Date();
  dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const validateDate = () => {
    const selectedDate = dateInput.value ? new Date(`${dateInput.value}T12:00:00`) : null;
    const selectedDay = selectedDate ? selectedDate.getDay() : null;
    const isWeekend = selectedDay === 0 || selectedDay === 6;
    const isPastDate = dateInput.value && dateInput.value < dateInput.min;
    dateInput.setCustomValidity(
      isWeekend
        ? "El taller recibe citas de lunes a viernes."
        : isPastDate
          ? "Selecciona una fecha de hoy en adelante."
          : ""
    );
  };
  const updateAvailability = () => {
    const bookedTimes = new Set(
      getStoredAppointments()
        .filter((saved) => saved.date === dateInput.value)
        .map((saved) => saved.time)
    );
    Array.from(timeSelect.options).forEach((option) => {
      if (option.value) option.disabled = bookedTimes.has(option.value);
    });
    if (timeSelect.selectedOptions[0] && timeSelect.selectedOptions[0].disabled) {
      timeSelect.value = "";
    }
  };
  dateInput.addEventListener("change", () => {
    validateDate();
    updateAvailability();
  });
  dateInput.addEventListener("input", validateDate);

  if (!booking) {
    submitButton.disabled = true;
    message.textContent = "Primero completa los detalles del servicio.";
    const link = document.createElement("a");
    link.href = "page1.html";
    link.textContent = " Ir a solicitar un servicio.";
    message.append(link);
    return;
  }

  document.getElementById("summaryService").textContent = booking.service === "Personalizado"
    ? `${booking.service}: ${booking.customService}`
    : booking.service;
  document.getElementById("summaryBoat").textContent = booking.boat;
  document.getElementById("summaryIssue").textContent = booking.issue;
  document.getElementById("summaryWorkType").textContent = booking.workType;
  document.getElementById("summaryLocation").textContent =
    booking.serviceLocation === "Otra"
      ? booking.otherLocation
      : booking.serviceLocation === "Fajardo"
        ? "Fajardo, fuera de marina"
        : "Dentro de marina";
  document.getElementById("summaryInspection").textContent = getInspectionPrice(booking);
  document.getElementById("summaryCustomer").textContent = `${booking.customerName} · ${booking.email} · ${booking.phone}`;
  document.getElementById("inspectionPrice").textContent =
    `Costo de inspección: ${getInspectionPrice(booking)}`;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateDate();
    updateAvailability();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const appointment = {
      ...booking,
      date: getFormValue(formData, "appointmentDate"),
      time: getFormValue(formData, "appointmentTime"),
      reference: `NFX-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      inspectionPrice: getInspectionPrice(booking),
      status: "Cita confirmada · pendiente de diagnóstico",
      nextStep: "Coordina el depósito de $30.00 con el taller.",
      createdAt: new Date().toISOString()
    };
    appointment.timeline = createAppointmentTimeline(appointment.createdAt);
    const appointments = getStoredAppointments();
    if (appointments.some((saved) =>
      saved.date === appointment.date && saved.time === appointment.time
    )) {
      message.textContent = "Ese horario ya está reservado en este navegador. Selecciona otra hora.";
      updateAvailability();
      return;
    }

    if (saveStoredData(STORAGE_KEYS.appointments, [...appointments, appointment], message)) {
      window.localStorage.removeItem(STORAGE_KEYS.draft);
      window.location.href = `page8.html?referencia=${encodeURIComponent(appointment.reference)}`;
    }
  });
}

function setupAppointmentConfirmation() {
  const confirmation = document.getElementById("appointmentConfirmation");
  if (!confirmation) return;

  const message = document.getElementById("confirmationMessage");
  const reference = new URLSearchParams(window.location.search).get("referencia");
  const appointment = reference
    ? getStoredAppointments().find((saved) =>
      saved.reference.toUpperCase() === reference.trim().toUpperCase()
    )
    : null;

  if (!appointment) {
    message.textContent = "No encontramos la cita en los datos guardados de este navegador. Regresa a Agendar cita para crear una solicitud.";
    message.setAttribute("role", "alert");
    return;
  }

  const serviceName = appointment.service === "Personalizado"
    ? `${appointment.service}: ${appointment.customService}`
    : appointment.service;
  document.getElementById("confirmationReference").textContent = appointment.reference;
  document.getElementById("confirmationBoat").textContent = appointment.boat || "No especificada";
  document.getElementById("confirmationService").textContent = serviceName || "No especificado";
  document.getElementById("confirmationSchedule").textContent =
    `${formatDate(appointment.date)} · ${appointment.time || "Hora no disponible"}`;
  document.getElementById("confirmationStatus").textContent =
    appointment.status || "Solicitud de cita guardada";

  const trackingLink = document.getElementById("confirmationTrackingLink");
  trackingLink.href = `page3.html?referencia=${encodeURIComponent(appointment.reference)}`;
  confirmation.hidden = false;
  message.textContent = "La solicitud se guardó en este navegador. Esta demostración no envía la cita al taller ni procesa el depósito.";
}

function displayAppointment(appointment) {
  document.getElementById("trackingReference").textContent = appointment.reference;
  document.getElementById("trackingService").textContent = appointment.service === "Personalizado"
    ? `${appointment.service}: ${appointment.customService}`
    : appointment.service;
  document.getElementById("trackingBoat").textContent = appointment.boatId
    ? `${appointment.boat} · ${appointment.boatId}`
    : appointment.boat;
  document.getElementById("trackingSchedule").textContent =
    `${formatDate(appointment.date)} · ${appointment.time || "Hora no disponible"}`;
  const { updates, activeStage } = getAppointmentTimeline(appointment);
  const currentUpdate = updates[activeStage];
  const updatedAt = getUpdateTimestamp(currentUpdate);
  document.getElementById("trackingStageTitle").textContent = currentUpdate.title || "Estado actual";
  document.getElementById("trackingStatus").textContent = appointment.status || currentUpdate.status || "En revisión";
  document.getElementById("trackingStageDetail").textContent =
    currentUpdate.detail || "Todavía no hay detalles disponibles para esta actualización.";
  document.getElementById("trackingUpdatedAt").textContent =
    `Última actualización: ${formatDetailedTimestamp(updatedAt, currentUpdate.time)}`;
  renderEvidenceFolder(currentUpdate, updatedAt);
}

function getAppointmentTimeline(appointment) {
  const updates = Array.isArray(appointment.timeline) && appointment.timeline.length
    ? appointment.timeline
    : createAppointmentTimeline(appointment.createdAt);
  const firstActiveStage = updates.findIndex((update) => update.status !== "Completada");
  const activeStage = firstActiveStage < 0 ? updates.length - 1 : firstActiveStage;

  return { updates, activeStage };
}

function formatDetailedTimestamp(value, fallbackTime) {
  if (typeof value !== "string" || !value) return "Fecha y hora pendientes";
  if (!value.includes("T")) {
    return `${formatDate(value)}${fallbackTime ? ` · ${fallbackTime}` : ""}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha y hora no disponibles";
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "full",
    timeStyle: "long"
  }).format(date);
}

function getUpdateTimestamp(update) {
  if (typeof update.date === "string" && update.date &&
    (update.date.includes("T") || update.time)) {
    return update.date;
  }
  return new Date().toISOString();
}

function getEvidenceItems(update, updatedAt) {
  if (Array.isArray(update.evidence)) {
    const evidenceItems = update.evidence.filter((evidence) =>
      evidence && typeof evidence.image === "string"
    );
    if (evidenceItems.length) return evidenceItems;
  }
  if (update.image) {
    return [{
      fileName: update.imageLabel || "Evidencia anterior",
      image: update.image,
      createdAt: update.date,
      imageAlt: update.imageAlt
    }];
  }
  const stage = (update.title || "").toLowerCase();
  const demoEvidence = stage.includes("repar")
    ? [
      {
        fileName: "Trabajo mecánico · imagen ilustrativa",
        image: "imagenes/motor.jpg",
        imageAlt: "Técnico trabajando en un motor marino; imagen ilustrativa."
      },
      {
        fileName: "Revisión del motor · imagen ilustrativa",
        image: "imagenes/Russell-Marine-Mechanic-Photo-2-of-7-980x653.jpg",
        imageAlt: "Inspección de un motor marino en taller; imagen ilustrativa."
      }
    ]
    : stage.includes("calidad")
      ? [
        {
          fileName: "Revisión técnica · imagen ilustrativa",
          image: "imagenes/Russell-Marine-Mechanic-Photo-2-of-7-980x653.jpg",
          imageAlt: "Revisión técnica de un motor marino; imagen ilustrativa."
        },
        {
          fileName: "Embarcación en taller · imagen ilustrativa",
          image: "imagenes/boat.jpg",
          imageAlt: "Embarcación en un área de servicio; imagen ilustrativa."
        }
      ]
      : stage.includes("entrega")
        ? [{
          fileName: "Embarcación lista · imagen ilustrativa",
          image: "imagenes/boat.jpg",
          imageAlt: "Embarcación preparada para entrega; imagen ilustrativa."
        }]
        : [
          {
            fileName: "Ingreso de embarcación · imagen ilustrativa",
            image: "imagenes/boat.jpg",
            imageAlt: "Embarcación en un área de servicio; imagen ilustrativa."
          },
          {
            fileName: "Inspección inicial · imagen ilustrativa",
            image: "imagenes/manrepair.jpg",
            imageAlt: "Técnico realizando una inspección náutica; imagen ilustrativa."
          }
        ];
  return demoEvidence.map((evidence) => ({
    ...evidence,
    createdAt: updatedAt,
    illustrative: true
  }));
}

function renderEvidenceFolder(update, updatedAt) {
  const evidenceContainer = document.getElementById("trackingEvidence");
  const evidenceItems = getEvidenceItems(update, updatedAt);
  const hasIllustrations = evidenceItems.some((evidence) => evidence.illustrative);
  document.getElementById("trackingEvidenceSubtitle").textContent =
    `${update.title} · ${evidenceItems.length} ${evidenceItems.length === 1 ? "archivo" : "archivos"}` +
    (hasIllustrations ? " · fotos ilustrativas" : "");
  evidenceContainer.replaceChildren();

  if (!evidenceItems.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "tracking-evidence-empty";
    emptyState.textContent = "Todavía no se han añadido fotos a esta carpeta.";
    evidenceContainer.append(emptyState);
    return;
  }

  evidenceItems.forEach((evidence) => {
    const figure = document.createElement("figure");
    figure.className = "tracking-evidence-item";
    const image = document.createElement("img");
    image.src = evidence.image;
    image.alt = evidence.imageAlt || `Evidencia: ${evidence.fileName || update.title}`;
    const caption = document.createElement("figcaption");
    const fileName = document.createElement("strong");
    fileName.textContent = evidence.fileName || "Foto de evidencia";
    const timestamp = document.createElement("span");
    timestamp.textContent = formatDetailedTimestamp(evidence.createdAt || update.date, update.time);
    caption.append(fileName, timestamp);
    figure.append(image, caption);
    evidenceContainer.append(figure);
  });
}

function createDemoAppointment() {
  const updatedAt = new Date().toISOString();
  return {
    reference: "NFX-DEMO",
    boat: "Sea Ray 270 Sundancer",
    boatId: "PR-270",
    service: "Inspección y reparación de motor",
    date: "2026-11-19",
    time: "2:17 p. m.",
    status: "Cita confirmada · pendiente de diagnóstico",
    createdAt: updatedAt,
    timeline: [{
      title: "Diagnóstico",
      date: updatedAt,
      time: "2:17 p. m.",
      status: "En proceso",
      detail: "Ingreso confirmado. El taller realizará una inspección inicial para documentar el diagnóstico y las evidencias.",
      evidence: [
        {
          fileName: "Ingreso de embarcación · imagen ilustrativa",
          image: "imagenes/boat.jpg",
          imageAlt: "Embarcación ingresada al taller; imagen ilustrativa.",
          createdAt: updatedAt
        },
        {
          fileName: "Inspección inicial · imagen ilustrativa",
          image: "imagenes/manrepair.jpg",
          imageAlt: "Técnico realizando una inspección náutica; imagen ilustrativa.",
          createdAt: updatedAt
        }
      ]
    }]
  };
}

function setupTracking() {
  const form = document.getElementById("trackingForm");
  if (!form) return;

  const referenceInput = document.getElementById("reference");
  const message = document.getElementById("trackingMessage");
  const dialog = document.getElementById("trackingDialog");
  const supportsModalDialog = typeof dialog.showModal === "function";

  const openTrackingDialog = () => {
    if (supportsModalDialog) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
    dialog.classList.add("is-fallback-open");
  };

  const closeTrackingDialog = () => {
    if (supportsModalDialog) {
      if (dialog.open) dialog.close();
      return;
    }
    dialog.removeAttribute("open");
    dialog.classList.remove("is-fallback-open");
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (dialog.open || dialog.hasAttribute("open"))) {
      event.preventDefault();
      closeTrackingDialog();
    }
  });
  const closeButtons = [
    document.getElementById("closeTrackingDialog"),
    document.getElementById("closeTrackingDialogFooter")
  ];
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeTrackingDialog);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeTrackingDialog();
  });

  const appointments = getStoredAppointments();
  const latestAppointment = appointments.length ? appointments[appointments.length - 1] : null;
  const queryReference = new URLSearchParams(window.location.search).get("referencia");
  if (queryReference) referenceInput.value = queryReference;
  else if (latestAppointment) referenceInput.value = latestAppointment.reference;
  else referenceInput.value = "NFX-DEMO";

  const showTrackingDialog = (appointment) => {
    displayAppointment(appointment);
    openTrackingDialog();
  };

  if (queryReference) {
    if (queryReference.trim().toUpperCase() === "NFX-DEMO") {
      showTrackingDialog(createDemoAppointment());
      message.textContent = "Estás viendo una actualización demostrativa.";
    } else {
      const appointment = appointments.find((saved) =>
        saved.reference.toUpperCase() === queryReference.trim().toUpperCase()
      );
      if (appointment) {
        showTrackingDialog(appointment);
        message.textContent = "Encontramos la información guardada en este navegador.";
      } else {
        message.textContent = "No encontramos esa referencia en las citas guardadas en este navegador.";
      }
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const requestedReference = referenceInput.value.trim().toUpperCase();
    const currentAppointments = getStoredAppointments();
    if (requestedReference === "NFX-DEMO") {
      showTrackingDialog(createDemoAppointment());
      message.textContent = "Estás viendo una actualización demostrativa.";
      return;
    }
    const appointment = currentAppointments.find((saved) =>
      requestedReference === saved.reference.toUpperCase()
    );
    if (appointment) {
      showTrackingDialog(appointment);
      message.textContent = "Encontramos la información guardada en este navegador.";
    } else {
      message.textContent = currentAppointments.length
        ? "No encontramos esa referencia. Revisa el número o contacta con soporte."
        : "Todavía no hay citas guardadas en este navegador.";
    }
  });
}

function setupSupportForm() {
  const form = document.getElementById("supportForm");
  if (form) {
    const profile = readStoredData(STORAGE_KEYS.profile);
    const appointment = getLatestAppointment();
    if (profile) {
      document.getElementById("supportName").value = profile.name || "";
      document.getElementById("supportEmail").value = profile.email || "";
    } else if (appointment) {
      document.getElementById("supportName").value = appointment.customerName || "";
      document.getElementById("supportEmail").value = appointment.email || "";
    }
    if (appointment) document.getElementById("supportReference").value = appointment.reference;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const savedRequests = readStoredData(STORAGE_KEYS.supportRequests);
      if (savedRequests !== null && !Array.isArray(savedRequests)) {
        const status = document.getElementById("supportStatus");
        status.textContent = "No se pudo leer el historial de consultas guardado.";
        status.setAttribute("role", "alert");
        return;
      }
      const requests = Array.isArray(savedRequests) ? savedRequests : [];
      const request = {
        reference: `SOP-${Date.now().toString().slice(-6)}`,
        name: getFormValue(formData, "supportName"),
        email: getFormValue(formData, "supportEmail"),
        appointmentReference: getFormValue(formData, "supportReference"),
        topic: getFormValue(formData, "supportTopic"),
        message: getFormValue(formData, "supportMessage"),
        createdAt: new Date().toISOString()
      };

      if (saveStoredData(STORAGE_KEYS.supportRequests, [...requests, request], document.getElementById("supportStatus"))) {
        const status = document.getElementById("supportStatus");
        status.removeAttribute("role");
        status.textContent = `Consulta guardada solo en este navegador. Referencia local: ${request.reference}. Para que el equipo la reciba, envíala por correo.`;
        form.reset();
      }
    });
  }

  setupChatAssistant();
}

function setupChatAssistant() {
  const form = document.getElementById("chatForm");
  if (!form) return;

  const conversation = document.getElementById("chatConversation");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chatMessage");
    const question = input.value.trim();
    const lowerQuestion = question.toLowerCase();
    let response = "Para asistencia sobre tu embarcación, escribe a soporte@nauticfixpr.com. Este asistente no está conectado con el equipo.";
    if (lowerQuestion.includes("precio") || lowerQuestion.includes("inspección")) {
      response = "La inspección cuesta $0.00 dentro de marina, $100.00 en Fajardo fuera de marina y se cotiza por distancia en otras áreas. El depósito de cita es $30.00 y esta demo no procesa pagos.";
    } else if (lowerQuestion.includes("cita") || lowerQuestion.includes("horario")) {
      response = "El taller recibe citas de lunes a viernes, de 7:00 a.m. a 4:00 p.m. Completa la solicitud y coordina el depósito con el taller.";
    } else if (lowerQuestion.includes("seguimiento") || lowerQuestion.includes("referencia")) {
      response = "Abre Seguimiento y escribe la referencia guardada en este navegador. Para consultar una cita real, contacta directamente al taller.";
    } else if (lowerQuestion.includes("emergencia") || lowerQuestion.includes("urgente")) {
      response = "Para asistencia prioritaria en el muelle, escribe a soporte@nauticfixpr.com. Este canal automático no recibe emergencias.";
    }

    const questionLine = document.createElement("p");
    questionLine.textContent = `Tú: ${question}`;
    const responseLine = document.createElement("p");
    responseLine.textContent = `Asistente automático: ${response}`;
    conversation.append(questionLine, responseLine);
    input.value = "";
    input.focus();
  });
}

function renderAccountHistory(appointments) {
  const history = document.getElementById("accountHistory");
  if (!history) return;
  history.replaceChildren();
  if (!appointments.length) {
    const empty = document.createElement("li");
    empty.textContent = "Todavía no hay servicios registrados.";
    history.append(empty);
    return;
  }

  appointments.slice().reverse().forEach((appointment) => {
    const item = document.createElement("li");
    item.textContent =
      `${appointment.boat} · ${appointment.service} · ${appointment.status} · ${formatDate(appointment.date)} · Referencia ${appointment.reference}`;
    history.append(item);
  });
}

function setupProfile() {
  const form = document.getElementById("profileForm");
  if (!form) return;

  const appointments = getStoredAppointments();
  const appointment = appointments.length ? appointments[appointments.length - 1] : null;
  const profile = readStoredData(STORAGE_KEYS.profile) || (appointment
    ? {
      name: appointment.customerName,
      email: appointment.email,
      phone: appointment.phone
    }
    : {});
  const status = document.getElementById("profileStatus");

  document.getElementById("profileName").value = profile.name || "";
  document.getElementById("profileEmail").value = profile.email || "";
  document.getElementById("profilePhone").value = profile.phone || "";

  if (appointment) {
    document.getElementById("accountTrackingStatus").textContent =
      `${appointment.boat} · ${appointment.status}`;
    document.getElementById("accountTrackingLink").href =
      `page3.html?referencia=${encodeURIComponent(appointment.reference)}`;
  } else {
    document.getElementById("accountTrackingStatus").textContent =
      "Todavía no hay servicios registrados en este navegador.";
    document.getElementById("accountTrackingLink").href = "page1.html";
  }
  renderAccountHistory(appointments);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const savedProfile = {
      name: getFormValue(formData, "profileName"),
      email: getFormValue(formData, "profileEmail"),
      phone: getFormValue(formData, "profilePhone")
    };
    if (saveStoredData(STORAGE_KEYS.profile, savedProfile, status)) {
      status.textContent = "Tus datos de contacto se actualizaron.";
    }
  });
}

function setupWorkGallery() {
  const track = document.getElementById("workGalleryTrack");
  const toggle = document.getElementById("galleryAutoplay");
  if (!track || !toggle) return;

  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const updateMotion = () => {
    track.classList.toggle("is-paused", paused);
    track.classList.toggle("is-running", !paused);
    toggle.textContent = paused ? "Reanudar movimiento" : "Pausar movimiento";
  };

  toggle.addEventListener("click", () => {
    paused = !paused;
    updateMotion();
  });
  updateMotion();
}

document.addEventListener("DOMContentLoaded", () => {
  setupServiceForm();
  setupAppointmentForm();
  setupAppointmentConfirmation();
  setupTracking();
  setupSupportForm();
  setupProfile();
  setupWorkGallery();
});
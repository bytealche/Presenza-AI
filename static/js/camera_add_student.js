// camera_add_student.js
const saveInfoBtn = document.getElementById("saveInfoBtn");
const startCaptureBtn = document.getElementById("startCaptureBtn");
const addStudentBtn = document.getElementById("addStudentBtn");
const video = document.getElementById("video");
const captureStatus = document.getElementById("captureStatus");
const progressBar = document.getElementById("progressBar");
const studentsList = document.getElementById("studentsList");
const studentsEmptyState = document.getElementById("studentsEmptyState");
const refreshStudentsBtn = document.getElementById("refreshStudentsBtn");

const studentForm = document.getElementById("studentForm");
let captured = 0;
const maxImages = 50;
let images = [];
let stream = null;
let studentData = null;

function resetCaptureState() {
  captured = 0;
  images = [];
  captureStatus.innerText = `Captured 0 / ${maxImages}`;
  progressBar.style.width = "0%";
}

function studentLabel(student) {
  const parts = [student.name];
  if (student.enrollment_no) parts.push(`Enrollment: ${student.enrollment_no}`);
  if (student.roll) parts.push(`Roll: ${student.roll}`);
  if (student.class) parts.push(`Class: ${student.class}`);
  if (student.section) parts.push(`Section: ${student.section}`);
  return parts.join(" | ");
}

function renderStudents(students) {
  studentsList.innerHTML = "";
  if (!students.length) {
    studentsEmptyState.innerText = "No enrolled students found.";
    return;
  }
  studentsEmptyState.innerText = "";
  for (const student of students) {
    const item = document.createElement("div");
    item.className = "list-group-item d-flex justify-content-between align-items-start gap-3 flex-wrap";

    const meta = document.createElement("div");
    meta.className = "small";
    meta.innerHTML = `<div class="fw-semibold">#${student.id} ${student.name}</div><div class="text-muted">${studentLabel(student)}</div>`;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-outline-danger btn-sm";
    delBtn.innerText = "Delete";
    delBtn.addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete ${student.name} and all stored face data?`);
      if (!confirmed) return;
      delBtn.disabled = true;
      const resp = await fetch(`/students/${student.id}`, { method: "DELETE" });
      if (!resp.ok) {
        delBtn.disabled = false;
        alert("Failed to delete student.");
        return;
      }
      const payload = await resp.json();
      await loadStudents();
      if (payload.model_updated === false) {
        alert(`Student deleted, but model update failed: ${payload.model_update_error || "unknown error"}.`);
      } else {
        alert("Student deleted and model updated.");
      }
    });

    item.appendChild(meta);
    item.appendChild(delBtn);
    studentsList.appendChild(item);
  }
}

async function loadStudents() {
  studentsEmptyState.innerText = "Loading students...";
  studentsList.innerHTML = "";
  const resp = await fetch("/students");
  if (!resp.ok) {
    studentsEmptyState.innerText = "Failed to load students.";
    return;
  }
  const payload = await resp.json();
  renderStudents(payload.students || []);
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

async function waitForVideoReady() {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return;
  }
  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for camera preview."));
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
    }

    function handleReady() {
      cleanup();
      resolve();
    }

    video.addEventListener("loadedmetadata", handleReady, { once: true });
    video.addEventListener("canplay", handleReady, { once: true });
  });
}

async function warmUpVideoFrames() {
  if (typeof video.requestVideoFrameCallback === "function") {
    await new Promise(resolve => video.requestVideoFrameCallback(() => resolve()));
    await new Promise(resolve => video.requestVideoFrameCallback(() => resolve()));
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 800));
}

async function startCameraPreview() {
  stopCamera();
  captureStatus.innerText = "Requesting camera access...";
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await waitForVideoReady();
  await warmUpVideoFrames();
  captureStatus.innerText = `Captured ${captured} / ${maxImages}`;
}

async function captureFrameBlob(canvas, ctx) {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, "image/jpeg", 0.9));
}

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(studentForm);
  const res = await fetch("/add_student", { method: "POST", body: fd });
  const j = await res.json();
  if (!res.ok) {
    alert(j.error || "Failed to save student info");
    return;
  }
  studentData = Object.fromEntries(fd.entries());
  resetCaptureState();
  alert("Student info validated. Click Start Capture to open the camera.");
  startCaptureBtn.disabled = false;
});

startCaptureBtn.addEventListener("click", async () => {
  startCaptureBtn.disabled = true;
  try {
    resetCaptureState();
    await startCameraPreview();
    captureImagesLoop();
  } catch (err) {
    stopCamera();
    captureStatus.innerText = "Camera preview unavailable.";
    alert("Camera access error: " + err.message);
    startCaptureBtn.disabled = false;
  }
});

async function captureImagesLoop() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");

  while (captured < maxImages) {
    const blob = await captureFrameBlob(canvas, ctx);
    images.push(blob);
    captured++;
    captureStatus.innerText = `Captured ${captured} / ${maxImages}`;
    progressBar.style.width = `${(captured / maxImages) * 100}%`;
    // small visual flash
    await new Promise(r => setTimeout(r, 200));
  }

  // upload all images in one request
  const form = new FormData();
  for (const [key, value] of Object.entries(studentData || {})) {
    form.append(key, value);
  }
  images.forEach((b, i) => form.append("images[]", b, `img_${i}.jpg`));
  const resp = await fetch("/upload_face", { method: "POST", body: form });
  const payload = await resp.json();
  if (resp.ok) {
    if (payload.model_updated === false) {
      alert(`Captured images uploaded. Saved ${payload.saved} frames. Model update failed: ${payload.model_update_error || "unknown error"}.`);
    } else {
      alert(`Captured images uploaded. Saved ${payload.saved} frames. Model updated for the new student.`);
    }
    addStudentBtn.disabled = false;
    await loadStudents();
  } else {
    alert(payload.error || "Upload failed");
  }

  // stop camera
  stopCamera();
}

addStudentBtn.addEventListener("click", () => {
  alert("Student record complete. Returning to dashboard.");
  window.location.href = "/";
});

refreshStudentsBtn.addEventListener("click", async () => {
  try {
    resetCaptureState();
    await startCameraPreview();
  } catch (err) {
    stopCamera();
    captureStatus.innerText = "Camera preview unavailable.";
    alert("Camera refresh error: " + err.message);
  }
  await loadStudents();
});

loadStudents();

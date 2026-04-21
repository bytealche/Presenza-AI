const startMarkBtn = document.getElementById("startMarkBtn");
const stopMarkBtn = document.getElementById("stopMarkBtn");
const startCctvBtn = document.getElementById("startCctvBtn");
const stopCctvBtn = document.getElementById("stopCctvBtn");
const markVideo = document.getElementById("markVideo");
const markStatus = document.getElementById("markStatus");
const scanSummary = document.getElementById("scanSummary");
const recognizedList = document.getElementById("recognizedList");
const cctvSource = document.getElementById("cctvSource");
const cctvStatus = document.getElementById("cctvStatus");

let markStream = null;
let markInterval = null;
let cctvPoller = null;
const renderedEvents = new Set();
let markScanSession = 0;

startMarkBtn.addEventListener("click", async () => {
  markScanSession += 1;
  startMarkBtn.disabled = true;
  stopMarkBtn.disabled = false;
  try {
    markStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    markVideo.srcObject = markStream;
    await markVideo.play();
    markStatus.innerText = "Scanning classroom view...";
    const sessionId = markScanSession;
    markInterval = setInterval(() => captureAndRecognize(sessionId), 2000);
  } catch (err) {
    markStatus.innerText = `Camera error: ${err.message}`;
    startMarkBtn.disabled = false;
    stopMarkBtn.disabled = true;
  }
});

stopMarkBtn.addEventListener("click", stopBrowserCamera);

startCctvBtn.addEventListener("click", async () => {
  startCctvBtn.disabled = true;
  const source = cctvSource.value.trim() || "0";
  const res = await fetch("/cctv/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source })
  });
  const data = await parseApiResponse(res);
  if (data.error) {
    cctvStatus.innerText = data.error;
    startCctvBtn.disabled = false;
    stopCctvBtn.disabled = true;
    return;
  }
  cctvStatus.innerText = `CCTV scanner ${data.status}. Source: ${data.source || source}`;
  stopCctvBtn.disabled = false;
  startCctvPolling();
});

stopCctvBtn.addEventListener("click", async () => {
  await fetch("/cctv/stop", { method: "POST" });
  stopCctvBtn.disabled = true;
});

function stopBrowserCamera() {
  markScanSession += 1;
  if (markInterval) clearInterval(markInterval);
  markInterval = null;
  if (markStream) markStream.getTracks().forEach(track => track.stop());
  markStream = null;
  startMarkBtn.disabled = false;
  stopMarkBtn.disabled = true;
  markStatus.innerText = "Browser camera stopped.";
  scanSummary.innerText = "";
}

async function captureAndRecognize(sessionId) {
  if (sessionId !== markScanSession) return;
  if (!markStream) return;
  if (!markVideo.videoWidth || !markVideo.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = markVideo.videoWidth;
  canvas.height = markVideo.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(markVideo, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
  const fd = new FormData();
  fd.append("image", blob, "classroom.jpg");

  try {
    const res = await fetch("/recognize_faces", { method: "POST", body: fd });
    const data = await parseApiResponse(res);
    if (sessionId !== markScanSession || !markStream) return;
    renderRecognitionResult(data, markStatus, scanSummary);
  } catch (err) {
    if (sessionId !== markScanSession || !markStream) return;
    markStatus.innerText = `Recognition error: ${err.message}`;
  }
}

async function parseApiResponse(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  if (!res.ok) {
    return { error: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  }
  return { error: `Unexpected non-JSON response (HTTP ${res.status}).` };
}

function renderRecognitionResult(data, statusElement, summaryElement) {
  if (data.error) {
    statusElement.innerText = data.error;
    if (summaryElement) summaryElement.innerText = "";
    return;
  }
  const recognized = data.recognized || [];
  const spoofPart = data.spoof_count ? `, ${data.spoof_count} spoof blocked` : "";
  statusElement.innerText = `${data.face_count} face(s) detected${spoofPart}, ${data.recognized_count} matched.`;
  if (summaryElement) {
    const markedCount = recognized.filter(item => item.marked).length;
    summaryElement.innerText = `${markedCount} new attendance record(s) added in this scan.`;
  }
  recognized.forEach(addRecognitionItem);
}

function addRecognitionItem(item) {
  const eventKey = item.timestamp ? `${item.student_id}:${item.timestamp}` : `${item.student_id}:existing`;
  if (renderedEvents.has(eventKey)) return;
  renderedEvents.add(eventKey);

  const li = document.createElement("li");
  li.className = "list-group-item";
  const suffix = item.marked ? "Attendance marked" : "Already marked today";
  li.innerText = `${item.name} (${Math.round(item.confidence * 100)}%) - ${suffix}`;
  recognizedList.prepend(li);
}

function startCctvPolling() {
  if (cctvPoller) clearInterval(cctvPoller);
  cctvPoller = setInterval(async () => {
    try {
      const res = await fetch("/cctv/status");
      const data = await parseApiResponse(res);
      if (data.error) {
        cctvStatus.innerText = data.error;
        return;
      }
      const spoofPart = data.spoof_count ? ` | Spoof blocked: ${data.spoof_count}` : "";
      cctvStatus.innerText = `${data.message} | Source: ${data.source} | Faces: ${data.face_count}${spoofPart}`;
      (data.recognized || []).forEach(addRecognitionItem);
      if (!data.running) {
        startCctvBtn.disabled = false;
        stopCctvBtn.disabled = true;
      }
    } catch (err) {
      cctvStatus.innerText = `Status error: ${err.message}`;
    }
  }, 2000);
}

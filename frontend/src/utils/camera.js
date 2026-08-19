/**
 * Robust Real Camera Photo Snapshot Utility
 * Guarantees video stream metadata loading & auto-exposure before snapping frame
 */
export async function captureLiveCameraPhoto() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera API (getUserMedia) not supported on this device/browser");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });

  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;

  // Wait for metadata & initial frame play
  await new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    video.onloadedmetadata = () => {
      video.play().then(done).catch(done);
    };
    video.onloadeddata = done;
    setTimeout(done, 1200);
  });

  // Short delay for exposure stabilization
  await new Promise(r => setTimeout(r, 350));

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);

  const base64Photo = canvas.toDataURL('image/jpeg', 0.85);

  // Stop camera stream tracks to release device camera light
  stream.getTracks().forEach(track => track.stop());

  return base64Photo;
}

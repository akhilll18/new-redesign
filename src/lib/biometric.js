// Biometric verification in the browser.
// 1) Device biometrics (fingerprint / face on the phone or laptop) through WebAuthn platform authenticators:
//    the browser never sees the fingerprint; it only gets a signed "user verified" assertion.
// 2) Selfie capture from the camera for face attendance (a small thumbnail is stored as evidence).
// Server note: a real deployment must verify WebAuthn assertions on the server with the stored public key.

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function platformBiometricAvailable() {
  try {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Registers this device for the employee. Returns { credentialId } or throws.
export async function enrolDevice(emp) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "PeopleHub attendance" },
      user: { id: enc.encode(emp.employee_code), name: emp.login_id, displayName: emp.full_name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });
  return { credentialId: b64(cred.rawId) };
}

// Asks the device to verify the user's fingerprint / face. Resolves true when verified.
export async function verifyDevice(credentialId) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: credentialId ? [{ type: "public-key", id: unb64(credentialId), transports: ["internal"] }] : [],
      userVerification: "required",
      timeout: 60000,
    },
  });
  const flags = new Uint8Array(assertion.response.authenticatorData)[32];
  return (flags & 0x04) === 0x04; // UV bit: the user was verified biometrically or with the device PIN
}

// Opens the camera. Returns a MediaStream or throws.
export async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use the camera.");
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 320 } }, audio: false });
}

// Grabs a square thumbnail (jpeg data URL, ~4 KB) from a playing <video>.
export function snapshot(video, size = 96) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const s = Math.min(video.videoWidth, video.videoHeight) || size;
  const sx = ((video.videoWidth || size) - s) / 2;
  const sy = ((video.videoHeight || size) - s) / 2;
  c.getContext("2d").drawImage(video, sx, sy, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.7);
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

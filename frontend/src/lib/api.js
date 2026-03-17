const BASE = "http://localhost:3000";

async function request(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

export const api = {
  get: (path, token) => request("GET", path, null, token),
  post: (path, body, token) => request("POST", path, body, token),
  put: (path, body, token) => request("PUT", path, body, token),
  delete: (path, token) => request("DELETE", path, null, token),

  // Save the FCM token to the backend for the logged-in student
  saveFCMToken: (studentId, fcmToken, authToken) =>
    request("PUT", `/students/${studentId}`, { fcmToken }, authToken),
};
// /js/auth.js
document.addEventListener("DOMContentLoaded", () => {
  if (window.__mickeyAuthBooted) return;
  window.__mickeyAuthBooted = true;

  // If the widget isn't available yet, load it
  if (!window.netlifyIdentity) {
    const s = document.createElement("script");
    s.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
    s.defer = true;
    s.onload = initAuth;
    document.head.appendChild(s);
  } else {
    initAuth();
  }

  function initAuth() {
    if (window.__mickeyAuthInitDone) {
      try { netlifyIdentity.init(); } catch (_e) {}
      return;
    }
    window.__mickeyAuthInitDone = true;

    netlifyIdentity.on("init", user => {
      guard(user);
      updateUserBar(user);
    });
    netlifyIdentity.on("login", user => {
      guard(user);
      updateUserBar(user);
    });
    netlifyIdentity.on("logout", () => {
      window.location.replace("/"); // back to landing
    });
    netlifyIdentity.init();
  }

  function guard(user) {
    // If not logged in, bounce to landing (the 401 rule also protects /app/*)
    if (!user) return;

    // Trust Netlify route protection first. Only enforce roles here
    // when role data is actually present on the user object.
    const roles = (user.app_metadata && user.app_metadata.roles) || [];
    if (roles.length > 0 && !roles.includes("member")) {
      alert("Your account does not have access yet. Contact the admin.");
      window.location.replace("/");
    }
  }

  function updateUserBar(user) {
    const who = document.getElementById("who");
    const logout = document.getElementById("logout");
    if (!who || !logout) return;

    if (user) {
      who.textContent = user.email || "member";
      logout.style.display = "inline-block";
      logout.onclick = () => netlifyIdentity.logout();
    } else {
      who.textContent = "guest";
      logout.style.display = "none";
    }
  }
});

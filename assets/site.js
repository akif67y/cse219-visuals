/* ====================================================================
   Shared site chrome — ONE source of truth for the sidebar.
   Edit this file to change the brand, nav links, or footer on EVERY page.
   Each page just needs:  <aside class="sidebar" id="siteSidebar"></aside>
   and  <script src="assets/site.js" defer></script>
   ==================================================================== */
(function () {
  "use strict";

  // ---- edit me -------------------------------------------------------
  const SITE = {
    brand: {
      href: "index.html",
      code: "CSE 219",
      lines: ["Signals & Linear Systems", "CSE, BUET"],
    },
    // nav items: {href, icon, label} · {group:"Heading"} · {icon,label,soon:true}
    nav: [
      { href: "index.html", icon: "🏠", label: "Home" },
      { group: "Convolution" },
      { href: "computing-convolution.html", icon: "📐", label: "Computing Convolutions" },
      { href: "listening-to-convolution.html", icon: "🎧", label: "Listening to Convolutions" },
      { group: "Fourier Series" },
      { href: "fourier-vibrating-string.html", icon: "〰️", label: "Vibrating String" },
      { href: "fourier-heat-diffusion.html", icon: "🌡️", label: "Heat Diffusion" },
      { href: "fourier-series-builder.html", icon: "∑", label: "Fourier Series Builder" },
      { href: "fourier-epicycles-1d.html", icon: "🌀", label: "1D Epicycles" },
      { href: "fourier-epicycles-2d.html", icon: "✒️", label: "2D Epicycles" },
      { group: "Fourier Transform" },
      { href: "fourier-transform-from-series.html", icon: "∿", label: "From Series to Transform" },
      { href: "listening-to-frequencies.html", icon: "✂️", label: "Frequency Scissors" },
      { href: "noise-surgery.html", icon: "🩺", label: "Noise Cancellation" },
      { href: "image-denoising-fourier.html", icon: "🫧", label: "Image Denoising" },
      { href: "image-edge-detection-fourier.html", icon: "⚡", label: "Image Edge Finder" },
      { href: "image-compression-lab.html", icon: "🖼️", label: "Let’s Compress Images" },
    ],
    footer: "Anik Saha<br>aaniksahaa.2001@gmail.com",
  };
  // --------------------------------------------------------------------

  function currentPage() {
    let p = location.pathname.split("/").pop();
    return p ? p : "index.html";
  }

  function render() {
    const host = document.getElementById("siteSidebar");
    if (!host) return;
    const here = currentPage();

    const brand =
      `<a class="brand" href="${SITE.brand.href}">` +
      `<div class="code">${SITE.brand.code}</div>` +
      SITE.brand.lines.map((l) => `<div class="name">${l}</div>`).join("") +
      `</a>`;

    const items = SITE.nav
      .map((it) => {
        if (it.group) return `<div class="group">${it.group}</div>`;
        const ic = `<span class="ic">${it.icon || ""}</span>`;
        if (it.soon)
          return `<a class="disabled">${ic} ${it.label} <small>soon</small></a>`;
        const active = it.href === here ? " class=\"active\"" : "";
        return `<a href="${it.href}"${active}>${ic} ${it.label}</a>`;
      })
      .join("");

    host.innerHTML =
      brand +
      `<nav class="nav">${items}</nav>` +
      `<div class="side-foot">${SITE.footer}</div>`;
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", render);
  else render();
})();

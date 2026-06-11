
let inputData = "";
let map;
let layerGroup;

document.getElementById("fileInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    inputData = event.target.result;
  };

  reader.readAsText(file);
});

// DROP ZONE
const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  const file = e.dataTransfer.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (event) {
    inputData = event.target.result;
    document.getElementById("output").value = "Fichier chargé : " + file.name;
    showOnMap();
  };

  reader.readAsText(file);
});

function initMap() {
  if (map) return;

  map = L.map('map').setView([43.5, 5.4], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  layerGroup = L.layerGroup().addTo(map);
}

function clearMap() {
  if (layerGroup) layerGroup.clearLayers();
}

function convertToGPX() {
  const parser = new DOMParser();
  const xml = parser.parseFromString(inputData, "text/xml");

  const coords = xml.getElementsByTagName("coordinates");

  let gpx = `<?xml version="1.0"?>\n<gpx version="1.1">\n`;

  for (let i = 0; i < coords.length; i++) {
    const list = coords[i].textContent.trim().split(/\s+/);

    list.forEach(c => {
      const [lon, lat, ele] = c.split(",");
      if (lat && lon) {
        gpx += `<wpt lat="${lat}" lon="${lon}"></wpt>\n`;
      }
    });
  }

  gpx += `</gpx>`;
  document.getElementById("output").value = gpx;
}

function convertToKML() {
  const parser = new DOMParser();
  const xml = parser.parseFromString(inputData, "text/xml");

  const wpts = xml.getElementsByTagName("wpt");

  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n`;

  for (let i = 0; i < wpts.length; i++) {
    const lat = wpts[i].getAttribute("lat");
    const lon = wpts[i].getAttribute("lon");

    kml += `<Placemark><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>\n`;
  }

  kml += `</Document></kml>`;
  document.getElementById("output").value = kml;
}

function extractPoints() {
  const parser = new DOMParser();

  if (inputData.includes("<gpx")) {
    const xml = parser.parseFromString(inputData, "text/xml");
    const wpts = xml.getElementsByTagName("wpt");

    return Array.from(wpts).map(w => ({
      lat: parseFloat(w.getAttribute("lat")),
      lon: parseFloat(w.getAttribute("lon"))
    }));
  }

  if (inputData.includes("<kml")) {
    const xml = parser.parseFromString(inputData, "text/xml");
    const coords = xml.getElementsByTagName("coordinates");

    let pts = [];

    for (let c of coords) {
      const list = c.textContent.trim().split(/\s+/);

      list.forEach(p => {
        const [lon, lat] = p.split(",");
        pts.push({ lat: parseFloat(lat), lon: parseFloat(lon) });
      });
    }

    return pts;
  }

  return [];
}

function showOnMap() {
  initMap();
  clearMap();

  const pts = extractPoints();
  if (!pts.length) return;

  const latlngs = pts.map(p => [p.lat, p.lon]);

  const poly = L.polyline(latlngs, { color: 'red' }).addTo(layerGroup);

  pts.forEach(p => {
    L.circleMarker([p.lat, p.lon], { radius: 4 }).addTo(layerGroup);
  });

  map.fitBounds(poly.getBounds());
}

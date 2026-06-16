/* ===================================================================
   kml2gpx — logique applicative
   - Parse un fichier KML ou GPX vers une représentation normalisée
   - Convertit cette représentation vers l'autre format
   - Affiche le contenu sur une carte Leaflet (OSM / IGN Plan V2 / IGN BD Ortho)
   =================================================================== */
(() => {
  'use strict';

  /* ----------------------------------------------------------------
   * 1. Représentation normalisée
   *    { waypoints: [{lat,lon,ele,name,desc}],
   *      tracks:    [{name, segments: [[{lat,lon,ele}, ...], ...]}] }
   * ---------------------------------------------------------------- */

  function escapeXml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    }[c]));
  }

  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  /* ---------- KML : lecture ---------- */

  function parseCoordTuple(str) {
    const parts = str.trim().split(',');
    return { lon: num(parts[0]), lat: num(parts[1]), ele: num(parts[2]) };
  }

  function parseCoordBlock(text) {
    return (text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(parseCoordTuple)
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }

  function kmlToNormalized(xmlDoc) {
    const waypoints = [];
    const tracks = [];
    const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));

    placemarks.forEach((pm, idx) => {
      const name = pm.getElementsByTagName('name')[0]?.textContent.trim() || '';
      const desc = pm.getElementsByTagName('description')[0]?.textContent.trim() || '';

      const point = pm.getElementsByTagName('Point')[0];
      if (point) {
        const coordsTxt = point.getElementsByTagName('coordinates')[0]?.textContent;
        const pts = parseCoordBlock(coordsTxt);
        if (pts.length) {
          waypoints.push({ ...pts[0], name: name || `Point ${idx + 1}`, desc });
        }
      }

      const lineString = pm.getElementsByTagName('LineString')[0];
      if (lineString) {
        const coordsTxt = lineString.getElementsByTagName('coordinates')[0]?.textContent;
        const pts = parseCoordBlock(coordsTxt);
        if (pts.length > 1) {
          tracks.push({ name: name || `Tracé ${tracks.length + 1}`, segments: [pts] });
        }
      }

      const polygon = pm.getElementsByTagName('Polygon')[0];
      if (polygon) {
        const ring = polygon.getElementsByTagName('LinearRing')[0];
        const coordsTxt = ring?.getElementsByTagName('coordinates')[0]?.textContent;
        const pts = parseCoordBlock(coordsTxt);
        if (pts.length > 1) {
          tracks.push({ name: name || `Polygone ${tracks.length + 1}`, segments: [pts] });
        }
      }

      // Support basique des pistes étendues gx:Track (Google Earth / MyTracks)
      const gxTrack = pm.getElementsByTagName('gx:Track')[0];
      if (gxTrack) {
        const coordEls = Array.from(gxTrack.getElementsByTagName('gx:coord'));
        const pts = coordEls
          .map(el => el.textContent.trim().split(/\s+/))
          .filter(parts => parts.length >= 2)
          .map(parts => ({ lon: num(parts[0]), lat: num(parts[1]), ele: num(parts[2]) }))
          .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
        if (pts.length > 1) {
          tracks.push({ name: name || `Tracé ${tracks.length + 1}`, segments: [pts] });
        }
      }
    });

    return { waypoints, tracks };
  }

  /* ---------- GPX : lecture ---------- */

  function gpxToNormalized(xmlDoc) {
    const waypoints = Array.from(xmlDoc.getElementsByTagName('wpt')).map((wpt, idx) => ({
      lat: num(wpt.getAttribute('lat')),
      lon: num(wpt.getAttribute('lon')),
      ele: num(wpt.getElementsByTagName('ele')[0]?.textContent),
      name: wpt.getElementsByTagName('name')[0]?.textContent.trim() || `Point ${idx + 1}`,
      desc: wpt.getElementsByTagName('desc')[0]?.textContent.trim() || ''
    })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    const tracks = [];

    Array.from(xmlDoc.getElementsByTagName('trk')).forEach((trk, idx) => {
      const name = trk.getElementsByTagName('name')[0]?.textContent.trim() || `Trace ${idx + 1}`;
      const segments = Array.from(trk.getElementsByTagName('trkseg')).map(seg =>
        Array.from(seg.getElementsByTagName('trkpt')).map(pt => ({
          lat: num(pt.getAttribute('lat')),
          lon: num(pt.getAttribute('lon')),
          ele: num(pt.getElementsByTagName('ele')[0]?.textContent)
        })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      ).filter(seg => seg.length > 1);
      if (segments.length) tracks.push({ name, segments });
    });

    Array.from(xmlDoc.getElementsByTagName('rte')).forEach((rte, idx) => {
      const name = rte.getElementsByTagName('name')[0]?.textContent.trim() || `Itinéraire ${idx + 1}`;
      const pts = Array.from(rte.getElementsByTagName('rtept')).map(pt => ({
        lat: num(pt.getAttribute('lat')),
        lon: num(pt.getAttribute('lon')),
        ele: num(pt.getElementsByTagName('ele')[0]?.textContent)
      })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      if (pts.length > 1) tracks.push({ name, segments: [pts] });
    });

    return { waypoints, tracks };
  }

  /* ---------- Écriture KML ---------- */

  function normalizedToKml(data) {
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
    lines.push('<Document>');

    data.waypoints.forEach(wp => {
      lines.push('<Placemark>');
      lines.push(`<name>${escapeXml(wp.name || '')}</name>`);
      if (wp.desc) lines.push(`<description>${escapeXml(wp.desc)}</description>`);
      const coord = `${wp.lon},${wp.lat}${wp.ele !== undefined ? ',' + wp.ele : ''}`;
      lines.push(`<Point><coordinates>${coord}</coordinates></Point>`);
      lines.push('</Placemark>');
    });

    data.tracks.forEach(trk => {
      trk.segments.forEach((seg, i) => {
        const label = trk.segments.length > 1 ? `${trk.name} (${i + 1}/${trk.segments.length})` : trk.name;
        const coords = seg.map(p => `${p.lon},${p.lat}${p.ele !== undefined ? ',' + p.ele : ''}`).join(' ');
        lines.push('<Placemark>');
        lines.push(`<name>${escapeXml(label)}</name>`);
        lines.push('<LineString><tessellate>1</tessellate><coordinates>' + coords + '</coordinates></LineString>');
        lines.push('</Placemark>');
      });
    });

    lines.push('</Document>');
    lines.push('</kml>');
    return lines.join('\n');
  }

  /* ---------- Écriture GPX ---------- */

  function normalizedToGpx(data) {
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<gpx version="1.1" creator="kml2gpx" xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');

    data.waypoints.forEach(wp => {
      lines.push(`<wpt lat="${wp.lat}" lon="${wp.lon}">`);
      if (wp.ele !== undefined) lines.push(`<ele>${wp.ele}</ele>`);
      lines.push(`<name>${escapeXml(wp.name || '')}</name>`);
      if (wp.desc) lines.push(`<desc>${escapeXml(wp.desc)}</desc>`);
      lines.push('</wpt>');
    });

    data.tracks.forEach(trk => {
      lines.push('<trk>');
      lines.push(`<name>${escapeXml(trk.name || '')}</name>`);
      trk.segments.forEach(seg => {
        lines.push('<trkseg>');
        seg.forEach(p => {
          lines.push(`<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele !== undefined ? `<ele>${p.ele}</ele>` : ''}</trkpt>`);
        });
        lines.push('</trkseg>');
      });
      lines.push('</trk>');
    });

    lines.push('</gpx>');
    return lines.join('\n');
  }

  /* ---------- Distance (haversine) ---------- */

  function haversine(a, b) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function totalDistance(data) {
    let d = 0;
    data.tracks.forEach(trk => trk.segments.forEach(seg => {
      for (let i = 1; i < seg.length; i++) d += haversine(seg[i - 1], seg[i]);
    }));
    return d;
  }

  function formatDistance(m) {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  }

  /* ----------------------------------------------------------------
   * 2. Carte Leaflet
   * ---------------------------------------------------------------- */

  const map = L.map('map', { zoomControl: true }).setView([46.6, 2.4], 6);

  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contributeurs OpenStreetMap'
    }),
    ignplan: L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      { maxNativeZoom: 19, maxZoom: 22, attribution: 'IGN-F/Géoportail — Plan IGN V2' }
    ),
    ignortho: L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      { maxNativeZoom: 19, maxZoom: 22, attribution: 'IGN-F/Géoportail — BD Ortho' }
    )
  };
  baseLayers.osm.addTo(map);
  let currentBaseKey = 'osm';

  document.querySelectorAll('input[name="basemap"]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      map.removeLayer(baseLayers[currentBaseKey]);
      currentBaseKey = input.value;
      baseLayers[currentBaseKey].addTo(map);
    });
  });

  let dataLayerGroup = null;

  function renderOnMap(data) {
    if (dataLayerGroup) {
      map.removeLayer(dataLayerGroup);
      dataLayerGroup = null;
    }
    const layers = [];

    data.waypoints.forEach(wp => {
      const marker = L.circleMarker([wp.lat, wp.lon], {
        radius: 6,
        color: '#e8a23d',
        weight: 2,
        fillColor: '#e8a23d',
        fillOpacity: 0.85
      });
      if (wp.name) marker.bindPopup(`<strong>${escapeXml(wp.name)}</strong>${wp.desc ? '<br>' + escapeXml(wp.desc) : ''}`);
      layers.push(marker);
    });

    data.tracks.forEach(trk => {
      trk.segments.forEach(seg => {
        const line = L.polyline(seg.map(p => [p.lat, p.lon]), {
          color: '#5fb3a3',
          weight: 4,
          opacity: 0.9
        });
        if (trk.name) line.bindPopup(`<strong>${escapeXml(trk.name)}</strong>`);
        layers.push(line);
      });
    });

    if (layers.length) {
      dataLayerGroup = L.layerGroup(layers).addTo(map);
      const bounds = dataLayerGroup.getBounds ? dataLayerGroup.getBounds() : null;
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  /* ----------------------------------------------------------------
   * 3. UI
   * ---------------------------------------------------------------- */

  const els = {
    fileInput: document.getElementById('fileInput'),
    dropzone: document.getElementById('dropzone'),
    btnConvert: document.getElementById('btnConvert'),
    btnDownload: document.getElementById('btnDownload'),
    convertHint: document.getElementById('convertHint'),
    roFile: document.getElementById('roFile'),
    roFormat: document.getElementById('roFormat'),
    roPoints: document.getElementById('roPoints'),
    roTracks: document.getElementById('roTracks'),
    roDistance: document.getElementById('roDistance'),
    roStatus: document.getElementById('roStatus')
  };

  let state = {
    normalized: null,
    sourceFormat: null,   // 'kml' | 'gpx'
    baseName: 'export',
    converted: null,      // string
    convertedFormat: null
  };

  function setStatus(text, kind) {
    els.roStatus.textContent = text;
    els.roStatus.classList.remove('is-error', 'is-ok');
    if (kind) els.roStatus.classList.add(kind);
  }

  function resetReadout() {
    els.roFormat.textContent = '—';
    els.roPoints.textContent = '—';
    els.roTracks.textContent = '—';
    els.roDistance.textContent = '—';
  }

  function detectFormat(filename, text) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'kml') return 'kml';
    if (ext === 'gpx') return 'gpx';
    const head = text.slice(0, 500).toLowerCase();
    if (head.includes('<kml')) return 'kml';
    if (head.includes('<gpx')) return 'gpx';
    return null;
  }

  async function handleFile(file) {
    if (!file) return;
    els.roFile.textContent = file.name;
    state.baseName = file.name.replace(/\.[^.]+$/, '') || 'export';
    state.converted = null;
    state.convertedFormat = null;
    els.btnDownload.disabled = true;
    resetReadout();
    setStatus('lecture en cours…');

    try {
      const text = await file.text();
      const format = detectFormat(file.name, text);
      if (!format) throw new Error('Format non reconnu (ni .kml, ni .gpx).');

      const xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length) {
        throw new Error('Le fichier XML est mal formé.');
      }

      const normalized = format === 'kml' ? kmlToNormalized(xmlDoc) : gpxToNormalized(xmlDoc);
      if (!normalized.waypoints.length && !normalized.tracks.length) {
        throw new Error('Aucune coordonnée exploitable trouvée dans ce fichier.');
      }

      state.normalized = normalized;
      state.sourceFormat = format;

      els.roFormat.textContent = format.toUpperCase();
      els.roPoints.textContent = String(normalized.waypoints.length);
      els.roTracks.textContent = String(normalized.tracks.reduce((n, t) => n + t.segments.length, 0));
      els.roDistance.textContent = formatDistance(totalDistance(normalized));

      renderOnMap(normalized);

      els.btnConvert.disabled = false;
      const target = format === 'kml' ? 'GPX' : 'KML';
      els.btnConvert.textContent = `Convertir en ${target}`;
      els.convertHint.textContent = `Fichier ${format.toUpperCase()} détecté — conversion vers ${target} disponible.`;
      setStatus('prêt à convertir', 'is-ok');
    } catch (err) {
      state.normalized = null;
      state.sourceFormat = null;
      els.btnConvert.disabled = true;
      setStatus(err.message || 'erreur de lecture', 'is-error');
    }
  }

  els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach(evt =>
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
    })
  );
  els.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  els.btnConvert.addEventListener('click', () => {
    if (!state.normalized || !state.sourceFormat) return;
    try {
      if (state.sourceFormat === 'kml') {
        state.converted = normalizedToGpx(state.normalized);
        state.convertedFormat = 'gpx';
      } else {
        state.converted = normalizedToKml(state.normalized);
        state.convertedFormat = 'kml';
      }
      els.btnDownload.disabled = false;
      setStatus(`converti en ${state.convertedFormat.toUpperCase()}`, 'is-ok');
    } catch (err) {
      setStatus('échec de la conversion', 'is-error');
    }
  });

  els.btnDownload.addEventListener('click', () => {
    if (!state.converted) return;
    const mime = state.convertedFormat === 'gpx'
      ? 'application/gpx+xml'
      : 'application/vnd.google-earth.kml+xml';
    const blob = new Blob([state.converted], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.baseName}.${state.convertedFormat}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus('fichier enregistré', 'is-ok');
  });

})();

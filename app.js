// ════════════════════════════════════════════════════════════
// ari — PWA (adaptado de la maqueta Hi-Fi a app navegable real)
// ════════════════════════════════════════════════════════════
const {
  useState,
  useRef,
  useEffect,
  useCallback
} = React;

// ── paleta ──
const Y = '#FFD600',
  B = '#3D38ED',
  R = '#E0243A';
const D = '#111118',
  G = '#888',
  L = '#E2E2DD',
  W = '#FAF9F6';
const sk = {
  fontFamily: "'Caveat',cursive"
};
const mn = {
  fontFamily: "'MonaSans','Helvetica Neue',sans-serif"
};

// ── fotos ──
const P = {
  splashBg: 'photos/new_church.jpg',
  onboardHero: 'photos/new_window.jpg',
  tortuga: 'photos/tortuga.png',
  stripB: 'photos/new_bed.jpg',
  stripC: 'photos/new_chopsticks.jpg',
  day1Circle: 'photos/new_sun.jpg',
  day2Circle: 'photos/new_snow.jpg',
  ctaThumb: 'photos/new_beer.jpg',
  day4Bg: 'photos/new_laugh.jpg',
  day6Bg: 'photos/new_market.jpg',
  sobresDay1: 'photos/new_bali.jpg',
  sobresDay3: 'photos/new_polaroid.jpg',
  sobresDay7: 'photos/couple6.jpg',
  ahoraBg: 'photos/new_church.jpg',
  detailHero: 'photos/couple7.jpg',
  gridPhoto1: 'photos/couple5.jpg',
  gridPhoto2: 'photos/couple3.jpg',
  gridPhoto3: 'photos/couple8.jpg',
  gridPhoto4: 'photos/her2.jpg',
  gridPhoto5: 'photos/couple2.jpg',
  gridPhoto6: 'photos/couple4.jpg',
  onboardTog1: 'photos/couple1.jpg',
  onboardTog2: 'photos/her1.jpg'
};

// ════════════════════════════════════════════════════════════
// ESTADO PERSISTENTE (localStorage)
// ════════════════════════════════════════════════════════════
const KEY = 'ari.state.v1';
const DAY_MS = 86400000;
// Desbloquea los 7 días para editar/mejorar. Pon false antes de entregar.
const DEV_UNLOCK_ALL = true;
const loadState = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
};
const saveState = s => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {}
};
const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// día actual según fecha de inicio (1..7)
const computeCurrentDay = startISO => {
  if (!startISO) return 1;
  const diff = Math.floor((startOfDay(new Date()) - startOfDay(new Date(startISO))) / DAY_MS);
  return Math.max(1, Math.min(7, diff + 1));
};

// ms hasta la próxima medianoche local
const msToMidnight = () => {
  const n = new Date();
  const m = new Date(n);
  m.setHours(24, 0, 0, 0);
  return m - n;
};
const fmtCountdown = ms => {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000),
    mi = Math.floor(ms % 3600000 / 60000),
    s = Math.floor(ms % 60000 / 1000);
  const p = x => String(x).padStart(2, '0');
  return `${p(h)}:${p(mi)}:${p(s)}`;
};
const CODE_LEN = 6;
// Genera un código determinista a partir de lo que Ari contestó en los 7 días.
// Las mismas respuestas dan siempre el mismo código (único para ella).
const codeFromAnswers = (a = {}) => {
  const ck = a.checks || {},
    tx = a.texts || {},
    sc = a.scores || {},
    ph = a.photos || {},
    ex = a.expedition || {};
  const checksOf = d => Object.values(ck[d] || {}).filter(Boolean).length;
  const words = String(tx[5] || '').trim().split(/\s+/).filter(Boolean).length;
  const seedParts = [ph[1] ? ph[1].length : 0,
  // día 1 · foto de la simetría
  sc[2] || 0,
  // día 2 · mejor marca del dino
  ex.startedAt ? Date.parse(ex.startedAt) : 0,
  // día 3 · expedición submarino
  checksOf(4),
  // día 4 · retos de la vergüenza
  words,
  // día 5 · poema de las nutrias
  checksOf(6),
  // día 6 · checklist
  ph[7] ? ph[7].length : 0 // día 7 · foto de Belisario
  ];
  let h = 2166136261 >>> 0;
  const str = seedParts.join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const digits = [];
  let x = (h ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < CODE_LEN; i++) {
    x = Math.imul(x ^ x >>> 15, 2246822507) >>> 0;
    x = Math.imul(x ^ x >>> 13, 3266489909) >>> 0;
    x = (x ^ x >>> 16) >>> 0;
    digits.push(x % 10);
  }
  return digits;
};

// downscale de imagen subida → dataURL pequeño para guardar en localStorage
const downscaleImage = (file, max = 900, q = 0.72) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    let {
      width: w,
      height: h
    } = img;
    if (w > h && w > max) {
      h = Math.round(h * max / w);
      w = max;
    } else if (h >= w && h > max) {
      w = Math.round(w * max / h);
      h = max;
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    res(cv.toDataURL('image/jpeg', q));
  };
  img.onerror = e => {
    URL.revokeObjectURL(url);
    rej(e);
  };
  img.src = url;
});

// ════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ════════════════════════════════════════════════════════════

// Pantalla a pantalla completa (sin marco de móvil). Centrada en desktop.
const Screen = ({
  bg = W,
  dark = false,
  children
}) => /*#__PURE__*/React.createElement("div", {
  className: "ari-screen",
  style: {
    background: bg,
    color: dark ? '#fff' : D
  }
}, children);
const Btn = ({
  label,
  bg = B,
  color = 'white',
  onClick,
  disabled = false
}) => /*#__PURE__*/React.createElement("button", {
  onClick: disabled ? undefined : onClick,
  disabled: disabled,
  style: {
    height: 54,
    borderRadius: 14,
    background: bg,
    flexShrink: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...mn,
    fontSize: 16,
    fontWeight: 600,
    color,
    border: `2px solid ${D}`,
    boxShadow: '2px 2px 0 0 #000',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    WebkitTapHighlightColor: 'transparent'
  }
}, label);
const Lock = ({
  size = 18,
  color = G
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none"
}, /*#__PURE__*/React.createElement("rect", {
  x: 3,
  y: 9,
  width: 14,
  height: 9,
  rx: 3,
  stroke: color,
  strokeWidth: 1.5
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 9V7a3 3 0 016 0v2",
  stroke: color,
  strokeWidth: 1.5
}), /*#__PURE__*/React.createElement("circle", {
  cx: 10,
  cy: 13.5,
  r: 1.5,
  fill: color
}));
const Wave = ({
  played = 7,
  total = 14,
  accent = B
}) => {
  const hs = [3, 5, 8, 4, 7, 5, 3, 6, 4, 8, 5, 3, 6, 4];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2,
      alignItems: 'center',
      height: 26
    }
  }, Array.from({
    length: total
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 3,
      height: hs[i % hs.length] * 2.4,
      borderRadius: 2,
      background: i < played ? accent : 'rgba(255,255,255,0.15)'
    }
  })));
};
const Badge = ({
  children,
  bg = Y,
  color = D
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'inline-flex',
    background: bg,
    borderRadius: 99,
    padding: '3px 12px',
    border: `1.5px solid ${D}`,
    ...sk,
    fontSize: 14,
    color
  }
}, children);

// cabecera de día con foto + botón atrás funcional
const DayHeader = ({
  src,
  pos = 'center top',
  dayN,
  label,
  color = B,
  onBack
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    height: 185,
    position: 'relative',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("img", {
  src: src,
  style: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: pos
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom,rgba(13,13,20,.18) 0%,rgba(250,249,246,1) 100%)'
  }
}), /*#__PURE__*/React.createElement("button", {
  onClick: onBack,
  style: {
    position: 'absolute',
    top: 'calc(12px + env(safe-area-inset-top))',
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 12,
    background: 'rgba(0,0,0,0.4)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...mn,
    fontSize: 17,
    color: 'white',
    cursor: 'pointer'
  }
}, "\u2190"), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    bottom: 12,
    left: 20
  }
}, /*#__PURE__*/React.createElement(Badge, {
  bg: color,
  color: color === Y ? D : 'white'
}, label, " \xB7 D\xCDA ", dayN)));

// zona de subida de foto reutilizable
const UploadZone = ({
  photo,
  onPick,
  height = 140,
  hint = 'toca para tomar la foto'
}) => {
  const inputRef = useRef();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/*",
    capture: "environment",
    style: {
      display: 'none'
    },
    onChange: e => {
      const f = e.target.files && e.target.files[0];
      if (f) onPick(f);
      e.target.value = '';
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: () => inputRef.current && inputRef.current.click(),
    style: {
      height,
      borderRadius: 16,
      border: `2px dashed ${L}`,
      background: 'rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexShrink: 0,
      overflow: 'hidden',
      cursor: 'pointer',
      position: 'relative'
    }
  }, photo ? /*#__PURE__*/React.createElement("img", {
    src: photo,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top'
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("svg", {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 8,
    r: 3.5,
    stroke: G,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7",
    stroke: G,
    strokeWidth: 1.5,
    strokeLinecap: "round"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      ...sk,
      fontSize: 15,
      color: G
    }
  }, hint))));
};

// adjuntar foto/vídeo como prueba y enviarla por el menú nativo (WhatsApp, etc.)
const ProofShare = ({
  title = 'Prueba',
  text = 'Aquí está mi prueba 💪',
  accent = B
}) => {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const txt = accent === Y ? D : 'white';
  const pick = e => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      setFile(f);
      setNote('');
    }
    e.target.value = '';
  };
  const send = async e => {
    e.stopPropagation();
    if (!file) return;
    if (navigator.canShare && navigator.canShare({
      files: [file]
    })) {
      try {
        await navigator.share({
          files: [file],
          title,
          text
        });
      } catch (err) {
        if (err && err.name !== 'AbortError') setNote('No se pudo compartir. Inténtalo otra vez.');
      }
    } else {
      setNote('Tu dispositivo no permite compartir directamente; guarda el vídeo y envíalo por WhatsApp manualmente.');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      marginTop: 10,
      background: W,
      borderRadius: 12,
      border: `1.5px solid ${L}`,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "video/*,image/*",
    capture: "environment",
    style: {
      display: 'none'
    },
    onChange: pick
  }), /*#__PURE__*/React.createElement("div", {
    onClick: () => inputRef.current && inputRef.current.click(),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 9,
      background: `${accent}14`,
      border: `1.5px solid ${accent}66`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 15,
      flexShrink: 0
    }
  }, file ? '✅' : '🎥'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      fontWeight: 600,
      color: D
    }
  }, file ? 'Prueba lista' : 'Adjuntar prueba'), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      color: G,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, file ? file.name : 'foto o vídeo'))), file && /*#__PURE__*/React.createElement("button", {
    onClick: send,
    style: {
      height: 40,
      borderRadius: 11,
      background: accent,
      border: `2px solid ${D}`,
      boxShadow: '2px 2px 0 0 #000',
      ...mn,
      fontSize: 13,
      fontWeight: 600,
      color: txt,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent'
    }
  }, "Enviar prueba"), note && /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      color: G,
      lineHeight: 1.5
    }
  }, note, " ", /*#__PURE__*/React.createElement("a", {
    href: `https://wa.me/?text=${encodeURIComponent(text)}`,
    target: "_blank",
    rel: "noreferrer",
    style: {
      color: B,
      fontWeight: 600
    }
  }, "Abrir WhatsApp")));
};

// ════════════════════════════════════════════════════════════
// JUEGO — El Dinosaurio y las Hormigas (día 2, jugable)
// ════════════════════════════════════════════════════════════
const DinoGame = ({
  best = 0,
  onResult
}) => {
  const cvRef = useRef();
  const cbRef = useRef(onResult);
  cbRef.current = onResult;
  const initialBest = useRef(best);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const H = 172;
    let W = 316;
    const setup = () => {
      W = cv.parentElement.offsetWidth || 316;
      cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setup();
    const GND = H - 26; // suelo (donde apoyan las patas)
    const DW = 30,
      DH = 34,
      DX = 38;
    const GRAV = 0.62,
      JUMP = -10.6;
    let status = 'ready'; // ready | running | over
    let dinoY = GND,
      vy = 0;
    let obstacles = [];
    let speed = 4.2,
      frame = 0,
      score = 0,
      bestScore = initialBest.current || 0;
    let nextGap = 240,
      warmup = 75,
      waveLeft = 0;
    let raf;
    const reset = () => {
      dinoY = GND;
      vy = 0;
      obstacles = [];
      speed = 4.2;
      frame = 0;
      score = 0;
      nextGap = 240;
      warmup = 75;
      waveLeft = 0;
    };
    const jump = () => {
      if (status === 'running') {
        if (dinoY >= GND) {
          vy = JUMP;
        }
      } else {
        reset();
        status = 'running';
      }
    };
    const SZ = {
      sm: 6,
      md: 8,
      lg: 11
    };
    const pickSz = () => Math.random() < 0.32 ? 'sm' : Math.random() < 0.78 ? 'md' : 'lg';
    const pickType = () => Math.floor(Math.random() * 3);
    const finalizeGroup = specs => {
      let x = 0,
        h = 0;
      const ants = specs.map(({
        s,
        type,
        gap = 0
      }) => {
        const ox = x;
        x += s * 1.42 + gap;
        h = Math.max(h, s * 1.4);
        return {
          ox,
          s,
          type
        };
      });
      return {
        ants,
        w: x + 6,
        h
      };
    };
    const jumpDist = () => speed * (2 * -JUMP / GRAV);
    const setNextGap = (group, pattern) => {
      const jd = jumpDist();
      if (waveLeft > 0) {
        nextGap = jd * (0.72 + Math.random() * 0.28) + group.w * 0.12 + 28;
      } else if (pattern === 'wave') {
        nextGap = jd * (0.68 + Math.random() * 0.22) + 32;
      } else {
        const wide = group.w > 72 ? jd * 0.22 : 0;
        nextGap = jd * (1.12 + Math.random() * 0.58) + 38 + wide + group.w * 0.06;
      }
    };
    const spawn = () => {
      let pattern, group;
      if (waveLeft > 0) {
        pattern = Math.random() < 0.55 ? 'single' : 'pair';
        waveLeft--;
      } else {
        const r = Math.random();
        if (r < 0.24) pattern = 'single';else if (r < 0.46) pattern = 'pair';else if (r < 0.64) pattern = 'trio';else if (r < 0.82) pattern = 'cluster';else pattern = 'wave';
      }
      if (pattern === 'single') {
        const sk = pickSz();
        group = finalizeGroup([{
          s: SZ[sk],
          type: pickType()
        }]);
      } else if (pattern === 'pair') {
        const sk = pickSz();
        const sk2 = Math.random() < 0.45 ? pickSz() : sk;
        const gap = Math.random() < 0.5 ? SZ[sk] * 0.12 : SZ[sk] * 0.38;
        group = finalizeGroup([{
          s: SZ[sk],
          type: pickType(),
          gap
        }, {
          s: SZ[sk2] + (Math.random() < 0.25 ? 1 : 0),
          type: pickType()
        }]);
      } else if (pattern === 'trio') {
        const sk = pickSz();
        group = finalizeGroup([{
          s: SZ[sk],
          type: pickType(),
          gap: 2 + Math.floor(Math.random() * 4)
        }, {
          s: SZ[sk] + (Math.random() < 0.35 ? 2 : 0),
          type: pickType(),
          gap: 3 + Math.floor(Math.random() * 5)
        }, {
          s: SZ[pickSz()],
          type: pickType()
        }]);
      } else if (pattern === 'cluster') {
        const n = 4 + Math.floor(Math.random() * 3);
        const specs = [];
        for (let i = 0; i < n; i++) {
          specs.push({
            s: SZ[pickSz()],
            type: pickType(),
            gap: i < n - 1 ? Math.random() < 0.35 ? 1 : 4 + Math.floor(Math.random() * 4) : 0
          });
        }
        group = finalizeGroup(specs);
      } else {
        waveLeft = 2 + Math.floor(Math.random() * 3);
        group = finalizeGroup([{
          s: SZ[pickSz()],
          type: pickType(),
          gap: 2
        }, {
          s: SZ.md,
          type: pickType(),
          gap: 3
        }, {
          s: SZ[Math.random() < 0.5 ? 'sm' : 'md'],
          type: pickType()
        }]);
      }
      obstacles.push({
        x: W + 12,
        ...group
      });
      setNextGap(group, pattern);
    };
    const c1 = '#2d6e1f',
      c2 = '#4aad30';
    const drawDino = (x, feetY, run) => {
      const top = feetY - DH;
      // cola
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(x + 3, top + DH * 0.5);
      ctx.quadraticCurveTo(x - 14, top + DH * 0.32, x - 13, top + DH * 0.62);
      ctx.quadraticCurveTo(x - 3, top + DH * 0.74, x + 5, top + DH * 0.58);
      ctx.fill();
      // patas
      const legTop = top + DH * 0.74;
      const lA = run ? DH * 0.24 : DH * 0.18,
        lB = run ? DH * 0.16 : DH * 0.18;
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.26, legTop, 6, lB, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.52, legTop, 6, lA, 2);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.24, legTop + lB, 10, 3.5, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.50, legTop + lA, 10, 3.5, 2);
      ctx.fill();
      // cuerpo
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.ellipse(x + DW * 0.4, top + DH * 0.5, DW * 0.5, DH * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4abf35';
      ctx.beginPath();
      ctx.ellipse(x + DW * 0.33, top + DH * 0.55, DW * 0.2, DH * 0.26, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // cuello + cabeza
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.6, top + DH * 0.0, DW * 0.55, DH * 0.36, [6, 10, 4, 3]);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.roundRect(x + DW * 0.64, top + DH * 0.05, DW * 0.46, DH * 0.27, [5, 9, 3, 3]);
      ctx.fill();
      // ojo
      ctx.fillStyle = '#f0ede0';
      ctx.beginPath();
      ctx.arc(x + DW * 1.0, top + DH * 0.16, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x + DW * 1.03, top + DH * 0.16, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x + DW * 1.06, top + DH * 0.13, 1, 0, Math.PI * 2);
      ctx.fill();
    };
    const ANT_PAL = [{
      body: '#6a0808',
      thor: '#7a0000',
      head: '#8B1A1A',
      hi: '#b02020',
      leg: '#4a0303',
      stripe: null
    }, {
      body: '#4a0505',
      thor: '#5c0000',
      head: '#6a1010',
      hi: '#8a1818',
      leg: '#350202',
      stripe: '#c44'
    }, {
      body: '#8a2828',
      thor: '#9a3030',
      head: '#a83838',
      hi: '#c84848',
      leg: '#5a1818',
      stripe: '#7a5028'
    }];
    const drawAnt = (x, baseY, s, run, type = 0) => {
      const p = ANT_PAL[type % 3];
      const y = baseY - s * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.12, baseY - 1.5, s * 0.52, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.leg;
      ctx.lineWidth = Math.max(0.9, s * 0.12);
      ctx.lineCap = 'round';
      [-0.55, 0, 0.55].forEach((d, i) => {
        const lx = x + d * s * 0.52;
        const sl = s * 0.62 * (run && i % 2 === 0 ? 1.08 : 0.72);
        ctx.beginPath();
        ctx.moveTo(lx, y + s * 0.12);
        ctx.lineTo(lx - s * 0.32, baseY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx, y + s * 0.12);
        ctx.lineTo(lx + s * 0.32, baseY);
        ctx.stroke();
      });
      ctx.fillStyle = p.body;
      ctx.beginPath();
      ctx.ellipse(x - s * 0.4, y + s * 0.1, s * 0.46, s * 0.36, -0.12, 0, Math.PI * 2);
      ctx.fill();
      if (p.stripe) {
        ctx.fillStyle = p.stripe;
        ctx.beginPath();
        ctx.ellipse(x - s * 0.48, y + s * 0.06, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = p.thor;
      ctx.beginPath();
      ctx.ellipse(x + s * 0.04, y, s * 0.3, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.head;
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y - s * 0.05, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.hi;
      ctx.beginPath();
      ctx.arc(x + s * 0.56, y - s * 0.14, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.head;
      ctx.lineWidth = Math.max(0.8, s * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.7, y);
      ctx.lineTo(x + s * 0.86, y + s * 0.07);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.7, y + s * 0.04);
      ctx.lineTo(x + s * 0.84, y + s * 0.13);
      ctx.stroke();
      ctx.strokeStyle = p.leg;
      ctx.lineWidth = Math.max(0.7, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.6, y - s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.76, y - s * 0.52, x + s * 0.9, y - s * 0.44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.56, y - s * 0.22);
      ctx.quadraticCurveTo(x + s * 0.66, y - s * 0.48, x + s * 0.76, y - s * 0.54);
      ctx.stroke();
    };
    const loop = () => {
      frame++;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#141e0a');
      sky.addColorStop(1, '#0a1205');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a2e10';
      ctx.fillRect(0, GND, W, H - GND);
      ctx.fillStyle = '#2a4a1a';
      ctx.fillRect(0, GND, W, 3);
      // suelo en movimiento
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      const off = frame * (status === 'running' ? speed : 1.5) % 36;
      for (let gx = -off; gx < W; gx += 36) {
        ctx.fillRect(gx, GND + 9, 14, 2);
      }
      if (status === 'running') {
        score += 0.35 + speed * 0.02;
        speed += 0.0016;
        vy += GRAV;
        dinoY += vy;
        if (dinoY > GND) {
          dinoY = GND;
          vy = 0;
        }
        if (warmup > 0) warmup--;
        const rightX = obstacles.length ? Math.max(...obstacles.map(o => o.x)) : -Infinity;
        if (warmup <= 0 && (obstacles.length === 0 || W - rightX >= nextGap)) {
          spawn();
        }
        obstacles.forEach(o => {
          o.x -= speed;
        });
        obstacles = obstacles.filter(o => o.x + o.w > -12);
        const dl = DX + 5,
          dr = DX + DW - 4,
          dt = dinoY - DH + 5,
          db = dinoY - 2;
        outer: for (const o of obstacles) {
          for (const a of o.ants) {
            const ax = o.x + a.ox;
            const ol = ax - a.s * 0.9,
              or = ax + a.s * 1.15,
              ot = GND - a.s * 1.4,
              ob = GND;
            if (dr > ol && dl < or && db > ot && dt < ob) {
              status = 'over';
              const fin = Math.floor(score);
              bestScore = Math.max(bestScore, fin);
              if (cbRef.current) cbRef.current(fin);
              break outer;
            }
          }
        }
      }
      const antRun = Math.floor(frame / 3) % 2 === 0;
      obstacles.forEach(o => {
        o.ants.forEach(a => drawAnt(o.x + a.ox, GND, a.s, antRun, a.type));
      });
      drawDino(DX, dinoY, status === 'running' && dinoY >= GND && Math.floor(frame / 5) % 2 === 0);

      // HUD
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(String(Math.floor(score)).padStart(3, '0'), W - 10, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px sans-serif';
      ctx.fillText('best: ' + bestScore, W - 10, 32);
      ctx.textAlign = 'left';
      if (status !== 'running') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        if (status === 'ready') {
          ctx.fillStyle = '#FFD600';
          ctx.font = '700 17px sans-serif';
          ctx.fillText('TOCA PARA SALTAR', W / 2, H / 2 - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '12px sans-serif';
          ctx.fillText('esquiva las hormigas', W / 2, H / 2 + 16);
        } else {
          ctx.fillStyle = '#E0243A';
          ctx.font = '700 18px sans-serif';
          ctx.fillText('¡TE PILLARON!', W / 2, H / 2 - 10);
          ctx.fillStyle = 'white';
          ctx.font = '700 15px sans-serif';
          ctx.fillText('puntuación ' + Math.floor(score), W / 2, H / 2 + 11);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '12px sans-serif';
          ctx.fillText('toca para reintentar', W / 2, H / 2 + 31);
        }
        ctx.textAlign = 'left';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onDown = e => {
      e.preventDefault();
      jump();
    };
    const onKey = e => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', setup);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', setup);
    };
  }, []);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: cvRef,
    style: {
      display: 'block',
      width: '100%',
      height: 172,
      touchAction: 'none',
      cursor: 'pointer'
    }
  });
};

// ════════════════════════════════════════════════════════════
// CANVAS — Submarino (descenso real, día 3)
// level (0..6) = fase/profundidad actual; controla oscuridad, criaturas y
// cuánto se hunde el submarino. Se lee por ref para no reiniciar la animación.
// ════════════════════════════════════════════════════════════
const HifiSubCanvas = ({
  level = 0
}) => {
  const cvRef = useRef();
  const rafRef = useRef();
  const frRef = useRef(0);
  const lvRef = useRef(level);
  lvRef.current = level;
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.width = cv.parentElement.offsetWidth || 316;
    cv.height = 190;
    const W = cv.width,
      H = cv.height;
    const ctx = cv.getContext('2d');
    const cl = x => Math.max(0, Math.min(1, x));
    const drawFish = (x, y, size, color, flip = false) => {
      const d = flip ? -1 : 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.2, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - d * size * 1.2, y);
      ctx.lineTo(x - d * size * 2, y - size * 0.6);
      ctx.lineTo(x - d * size * 2, y + size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x + d * size * 0.5, y - size * 0.12, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawJellyfish = (x, y, size, color, t) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.6, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const tx = x - size * 0.6 + i * size * 0.4;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.quadraticCurveTo(tx + Math.sin(t * 2 + i) * 3, y + size * 0.8, tx + Math.sin(t * 3 + i) * 2, y + size * 1.6);
        ctx.stroke();
      }
    };
    const drawStarfish = (x, y, size, color, rot) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + i * Math.PI * 2 / 5 - Math.PI / 2;
        const ax = x + Math.cos(a) * size;
        const ay = y + Math.sin(a) * size;
        const ba = a + Math.PI * 2 / 10;
        const bx = x + Math.cos(ba) * size * 0.4;
        const by = y + Math.sin(ba) * size * 0.4;
        if (i === 0) ctx.moveTo(ax, ay);else ctx.lineTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();
    };
    const drawMantaRay = (x, y, size, color, t) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - size * 0.3, y);
      ctx.quadraticCurveTo(x - size * 1.2, y - size * 0.4 + Math.sin(t * 3) * size * 0.15, x - size * 0.8, y + size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y);
      ctx.quadraticCurveTo(x + size * 1.2, y - size * 0.4 + Math.sin(t * 3 + 1) * size * 0.15, x + size * 0.8, y + size * 0.1);
      ctx.closePath();
      ctx.fill();
    };
    const drawOctopus = (x, y, size, color, t) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y - size * 0.3, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const startX = x - size * 0.35 + i * size * 0.14;
        ctx.beginPath();
        ctx.moveTo(startX, y + size * 0.1);
        ctx.quadraticCurveTo(startX + Math.sin(t * 2.5 + i * 0.8) * size * 0.3, y + size * 0.6, startX + Math.sin(t * 1.5 + i) * size * 0.2, y + size * 1.0);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x - size * 0.15, y - size * 0.35, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + size * 0.15, y - size * 0.35, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawSquid = (x, y, size, color, t) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - size * 1.1);
      ctx.quadraticCurveTo(x + size * 0.55, y - size * 0.5, x + size * 0.32, y + size * 0.2);
      ctx.quadraticCurveTo(x, y + size * 0.45, x - size * 0.32, y + size * 0.2);
      ctx.quadraticCurveTo(x - size * 0.55, y - size * 0.5, x, y - size * 1.1);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const sx = x - size * 0.28 + i * size * 0.14;
        ctx.beginPath();
        ctx.moveTo(sx, y + size * 0.3);
        ctx.quadraticCurveTo(sx + Math.sin(t * 2 + i) * size * 0.2, y + size * 0.9, sx + Math.sin(t * 1.4 + i) * size * 0.15, y + size * 1.5);
        ctx.stroke();
      }
    };
    const drawAnglerfish = (x, y, size, t, a) => {
      ctx.fillStyle = `rgba(16,24,38,${0.85 * a + 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.05, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.95, y);
      ctx.lineTo(x + size * 1.7, y - size * 0.5);
      ctx.lineTo(x + size * 1.7, y + size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(190,205,225,${0.45 * a})`;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const tx = x - size * 0.95 + i * size * 0.2;
        ctx.beginPath();
        ctx.moveTo(tx, y + size * 0.2);
        ctx.lineTo(tx + size * 0.05, y + size * 0.42);
        ctx.stroke();
      }
      const lx = x - size * 1.15,
        ly = y - size * 1.15 + Math.sin(t * 2) * size * 0.18;
      ctx.strokeStyle = `rgba(120,180,160,${0.5 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.65, y - size * 0.5);
      ctx.quadraticCurveTo(x - size * 1.25, y - size * 1.0, lx, ly);
      ctx.stroke();
      const gl = (0.55 + Math.sin(t * 3) * 0.3) * a;
      ctx.shadowColor = 'rgba(130,255,205,0.9)';
      ctx.shadowBlur = 11;
      ctx.fillStyle = `rgba(160,255,215,${gl})`;
      ctx.beginPath();
      ctx.arc(lx, ly, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,238,170,${0.8 * a})`;
      ctx.beginPath();
      ctx.arc(x - size * 0.3, y - size * 0.18, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawGlow = (x, y, r, a) => {
      ctx.shadowColor = 'rgba(120,220,255,0.9)';
      ctx.shadowBlur = 9;
      ctx.fillStyle = `rgba(150,235,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };
    const render = () => {
      frRef.current++;
      const t = frRef.current * 0.018;
      const lvl = Math.max(0, Math.min(6, lvRef.current));
      const dk = Math.min(1, lvl / 6);
      const lt = 1 - dk;
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgb(${Math.round(4 + 18 * lt)},${Math.round(10 + 44 * lt)},${Math.round(30 + 80 * lt)})`);
      grad.addColorStop(1, `rgb(${Math.round(2 + 6 * lt)},${Math.round(4 + 14 * lt)},${Math.round(12 + 34 * lt)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // rayos de sol (sólo cerca de la superficie)
      const beamVis = cl(1.3 - lvl * 0.85);
      if (beamVis > 0.01) {
        for (let i = 0; i < 3; i++) {
          const bx = W * (0.2 + i * 0.3) + Math.sin(t * 0.3 + i) * 10;
          const bg = ctx.createLinearGradient(bx, 0, bx - 30, H);
          bg.addColorStop(0, `rgba(180,225,255,${0.10 * beamVis})`);
          bg.addColorStop(1, 'rgba(180,225,255,0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.moveTo(bx - 14, 0);
          ctx.lineTo(bx + 14, 0);
          ctx.lineTo(bx - 26, H);
          ctx.lineTo(bx - 54, H);
          ctx.fill();
        }
      }
      // nieve marina (más densa en profundidad)
      const snowN = 6 + Math.round(lvl * 2);
      for (let i = 0; i < snowN; i++) {
        const px = (W * 0.05 + i * W * 0.12 + (t * 14 * (i % 3 - 1) + W * 10)) % W;
        const py = (H * 0.15 + i * H * 0.1 + (t * 5 * (i % 2 * 2 - 1) + H * 10)) % H;
        ctx.fillStyle = `rgba(180,210,235,${0.04 + i % 3 * 0.02 + dk * 0.05})`;
        ctx.beginPath();
        ctx.arc(px, py, 1 + i % 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // peces de superficie
      const fishVis = cl(1.5 - lvl * 0.78);
      if (fishVis > 0.02) {
        const fc = [[100, 200, 255], [255, 190, 90], [255, 130, 130], [130, 255, 180], [255, 220, 120], [150, 210, 255]];
        for (let i = 0; i < 6; i++) {
          const fx = W * 1.3 - (t * 22 + i * 65) % (W * 1.6);
          const fy = H * 0.18 + i * 22 + Math.sin(t * 1.5 + i * 2) * 8;
          const c = fc[i % fc.length];
          drawFish(fx, fy, 4 + i % 3 * 2, `rgba(${c[0]},${c[1]},${c[2]},${0.4 * fishVis})`, false);
        }
      }
      // estrellas de mar en el lecho (superficie)
      if (fishVis > 0.05) {
        drawStarfish(W * 0.55, H * 0.9, 5, `rgba(255,150,70,${0.32 * fishVis})`, t * 0.1);
        drawStarfish(W * 0.85, H * 0.93, 4, `rgba(255,90,90,${0.28 * fishVis})`, t * 0.08 + 1);
      }
      // manta + medusas (zona media)
      const midVis = cl(Math.min(lvl - 0.2, 1)) * cl(3.6 - lvl);
      if (midVis > 0.02) {
        drawMantaRay(W * 1.4 - t * 12 % (W * 1.8), H * 0.55 + Math.sin(t * 0.6) * 8, 14, `rgba(80,120,200,${0.32 * midVis})`, t);
        drawJellyfish(W * 0.78 + Math.sin(t * 0.3) * 20, H * 0.35 + Math.sin(t * 0.5) * 12, 8, `rgba(210,130,255,${0.3 * midVis})`, t);
        drawJellyfish(W * 0.15 + Math.sin(t * 0.25 + 2) * 15, H * 0.62 + Math.sin(t * 0.4 + 1) * 10, 6, `rgba(110,205,255,${0.26 * midVis})`, t + 1);
      }
      // pulpo (zona abisal)
      const octVis = cl(Math.min(lvl - 0.8, 1)) * cl(3.8 - lvl);
      if (octVis > 0.02) {
        drawOctopus(W * 0.62 + Math.sin(t * 0.35) * 18, H * 0.46 + Math.sin(t * 0.45 + 2) * 10, 10, `rgba(155,89,182,${0.34 * octVis})`, t);
      }
      // criaturas bioluminiscentes del abismo (pez abisal + calamar)
      const bioVis = cl(lvl - 2.1);
      if (bioVis > 0.02) {
        drawAnglerfish(W * 0.72 + Math.sin(t * 0.25) * 16, H * 0.42 + Math.sin(t * 0.4) * 8, 12, t, Math.min(1, bioVis));
        const deepFade = cl(4.6 - lvl);
        if (deepFade > 0.05) {
          drawSquid(W * 0.24 + Math.sin(t * 0.3 + 1) * 14, H * 0.6 + Math.sin(t * 0.5) * 9, 11, `rgba(120,90,150,${0.32 * deepFade * bioVis})`, t);
        }
      }
      // destellos bioluminiscentes a la deriva (cada vez más escasos)
      const sparks = Math.max(0, Math.round(8 - lvl));
      if (lvl > 2.4) {
        for (let i = 0; i < sparks; i++) {
          const gx = (W * 0.1 + i * W * 0.21 + Math.sin(t * 0.4 + i) * 20 + W * 5) % W;
          const gy = (H * 0.2 + i * H * 0.16 + Math.cos(t * 0.3 + i * 1.3) * 16 + H * 5) % H;
          const ga = (0.18 + Math.sin(t * 1.5 + i * 2) * 0.14) * cl(lvl - 2.4);
          if (ga > 0.02) drawGlow(gx, gy, 1.3 + i % 2 * 0.8, ga);
        }
      }
      // submarino (se hunde con la profundidad)
      const sink = Math.min(lvl, 6) / 6;
      const sy = H * (0.3 + 0.34 * sink) + Math.sin(t * 0.8) * 4,
        sx = W * 0.3;
      // burbujas que suben del submarino
      for (let i = 0; i < 6; i++) {
        const by = sy - (t * 26 + i * 20) % (sy * 0.7 + 18);
        const bx = sx + 26 + Math.sin(t * 2 + i) * 3;
        ctx.fillStyle = `rgba(190,225,255,${0.22 * (1 - by / sy)})`;
        ctx.beginPath();
        ctx.arc(bx, by, 1.4 + i % 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#3a5a8a';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 28, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a6a9a';
      ctx.beginPath();
      ctx.ellipse(sx + 5, sy - 1, 20, 6, 0, 0, Math.PI * 1);
      ctx.fill();
      ctx.fillStyle = '#2d4a7a';
      ctx.beginPath();
      ctx.roundRect(sx - 4, sy - 14, 12, 8, [3, 3, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#2d4a7a';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy - 14);
      ctx.lineTo(sx + 2, sy - 21);
      ctx.lineTo(sx + 8, sy - 21);
      ctx.stroke();
      ctx.fillStyle = 'rgba(130,190,255,0.32)';
      ctx.beginPath();
      ctx.arc(sx + 9, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      const pa = t * 4;
      ctx.strokeStyle = '#4a6a9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 28, sy - 4);
      ctx.lineTo(sx - 35, sy - 4 + Math.sin(pa) * 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 28, sy + 4);
      ctx.lineTo(sx - 35, sy + 4 + Math.sin(pa + Math.PI) * 6);
      ctx.stroke();
      // el faro del submarino brilla más fuerte cuanto más oscuro está
      const beamA = 0.1 + dk * 0.22;
      ctx.fillStyle = `rgba(255,235,100,${0.5 + Math.sin(t * 2) * 0.15})`;
      ctx.beginPath();
      ctx.arc(sx + 26, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      const beam = ctx.createLinearGradient(sx + 28, sy - 7, sx + 78, sy - 18);
      beam.addColorStop(0, `rgba(255,235,120,${beamA})`);
      beam.addColorStop(1, 'rgba(255,235,120,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sx + 28, sy - 3);
      ctx.lineTo(sx + 78, sy - 18);
      ctx.lineTo(sx + 78, sy + 8);
      ctx.lineTo(sx + 28, sy + 3);
      ctx.fill();
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: cvRef,
    style: {
      display: 'block',
      width: '100%',
      height: 190
    }
  });
};

// contenedor scrollable interno con padding
const Body = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...style
  }
}, children);

// ════════════════════════════════════════════════════════════
// SPLASH
// ════════════════════════════════════════════════════════════
const ScreenSplash = () => /*#__PURE__*/React.createElement(Screen, {
  bg: D,
  dark: true
}, /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    position: 'relative'
  }
}, /*#__PURE__*/React.createElement("img", {
  src: P.splashBg,
  style: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center top',
    opacity: 0.12
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    textAlign: 'center'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 92,
    fontWeight: 700,
    color: Y,
    letterSpacing: -6,
    lineHeight: 1,
    textShadow: `0 0 60px ${Y}55`
  }
}, "ari"), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    bottom: 0,
    right: -7,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: R,
    boxShadow: `0 0 14px ${R}`
  }
})), /*#__PURE__*/React.createElement("div", {
  style: {
    ...sk,
    fontSize: 18,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 2,
    position: 'relative'
  }
}, "tus aventuras"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 8,
    marginTop: 20,
    position: 'relative'
  }
}, [Y, B, R].map((c, i) => /*#__PURE__*/React.createElement("div", {
  key: i,
  className: "ari-dot",
  style: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: c,
    animationDelay: `${i * 0.15}s`
  }
})))));

// ════════════════════════════════════════════════════════════
// ONBOARDING 1 — Hola
// ════════════════════════════════════════════════════════════
const ScreenOnboard = ({
  onNext
}) => /*#__PURE__*/React.createElement(Screen, {
  bg: W
}, /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    height: 240,
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("img", {
  src: P.onboardHero,
  style: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center top'
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, transparent 40%, rgba(250,249,246,0.98) 100%)'
  }
})), /*#__PURE__*/React.createElement("div", {
  style: {
    padding: '0 24px 24px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  }
}, /*#__PURE__*/React.createElement(Badge, null, "\uD83D\uDC9B solo para ari"), /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 27,
    fontWeight: 700,
    color: D,
    lineHeight: 1.2,
    marginTop: 10,
    flexShrink: 0
  }
}, "Hola, Ari.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
  style: {
    color: B
  }
}, "Tengo algo", /*#__PURE__*/React.createElement("br", null), "preparado para ti.")), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
    flexShrink: 0
  }
}, [P.day1Circle, P.stripB, P.stripC].map((src, i) => /*#__PURE__*/React.createElement("img", {
  key: i,
  src: src,
  style: {
    flex: 1,
    height: 56,
    borderRadius: 10,
    objectFit: 'cover',
    objectPosition: 'center top',
    border: `2px solid ${W}`
  }
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 12,
    background: 'white',
    borderRadius: 12,
    padding: 14,
    border: `1.5px dashed ${L}`,
    flexShrink: 0,
    ...sk,
    fontSize: 16,
    color: '#555',
    lineHeight: 1.6
  }
}, "\"Sorpresas, retos y momentos", /*#__PURE__*/React.createElement("br", null), "dise\xF1ados solo para ti.", /*#__PURE__*/React.createElement("br", null), "\xBFLista para empezar? \uD83D\uDD12\""), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
    flexShrink: 0
  }
}, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
  key: i,
  style: {
    height: 4,
    width: i === 0 ? 22 : 8,
    borderRadius: 2,
    background: i === 0 ? B : L
  }
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minHeight: 16
  }
}), /*#__PURE__*/React.createElement(Btn, {
  label: "Empezar \u2192",
  bg: B,
  onClick: onNext
}), /*#__PURE__*/React.createElement("div", {
  style: {
    ...sk,
    fontSize: 15,
    color: G,
    textAlign: 'center',
    marginTop: 8,
    flexShrink: 0
  }
}, "te quiero \uD83D\uDC9B"))));

// ════════════════════════════════════════════════════════════
// ONBOARDING 2 — Pequeños recuerdos
// ════════════════════════════════════════════════════════════
const ScreenOnboardMemories = ({
  onNext
}) => {
  const borders = [Y, B, R, B, R, Y];
  return /*#__PURE__*/React.createElement(Screen, {
    bg: "#F5F3EE"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 'calc(16px + env(safe-area-inset-top)) 20px 24px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 3,
      background: B,
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      fontWeight: 700,
      color: B,
      letterSpacing: 2.5,
      textTransform: 'uppercase'
    }
  }, "NUESTRAS FOTOS \uD83D\uDCF7")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 32,
      fontWeight: 700,
      color: '#0E1A40',
      lineHeight: 1.05,
      marginTop: 10,
      flexShrink: 0
    }
  }, "Peque\xF1os", /*#__PURE__*/React.createElement("br", null), "recuerdos"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      color: '#7A8099',
      lineHeight: 1.65,
      marginTop: 7,
      flexShrink: 0
    }
  }, "Algunos retos est\xE1n inspirados", /*#__PURE__*/React.createElement("br", null), "en momentos nuestros."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 7,
      marginTop: 14,
      flexShrink: 0
    }
  }, [{
    src: P.gridPhoto1,
    pos: 'center top'
  }, {
    src: P.gridPhoto2,
    pos: 'center top'
  }, {
    src: P.gridPhoto3,
    pos: 'center top'
  }, {
    src: P.gridPhoto4,
    pos: 'center top'
  }, {
    src: P.gridPhoto5,
    pos: 'center top'
  }, {
    src: P.gridPhoto6,
    pos: 'center top'
  }].map((ph, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderRadius: 16,
      overflow: 'hidden',
      border: `2.5px dashed ${borders[i]}`,
      height: 108,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: ph.src,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: ph.pos
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 14,
      flexShrink: 0
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      height: 4,
      width: i === 1 ? 22 : 8,
      borderRadius: 2,
      background: i === 1 ? B : '#D9D5CC'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 16
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    label: "Siguiente \u2192",
    bg: "#0E1A40",
    onClick: onNext
  })));
};

// ════════════════════════════════════════════════════════════
// ONBOARDING 3 — Para los dos
// ════════════════════════════════════════════════════════════
const ScreenOnboardTogether = ({
  onNext
}) => {
  const features = [{
    ic: '🗺️',
    color: B,
    title: 'Aventuras juntos',
    desc: 'Misiones diseñadas para hacer en pareja, donde sea que estén.'
  }, {
    ic: '📸',
    color: R,
    title: 'Guardar recuerdos',
    desc: 'Cada reto termina con fotos y momentos que quedan para siempre.'
  }, {
    ic: '💌',
    color: Y,
    title: 'Mensajes sorpresa',
    desc: 'Notas de voz y cartas que llegan en el momento exacto.'
  }, {
    ic: '🔒',
    color: B,
    title: 'Solo de los dos',
    desc: 'Nadie más tiene acceso. Este espacio es completamente nuestro.'
  }];
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 'calc(14px + env(safe-area-inset-top)) 22px 24px',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1.3,
      height: 122,
      borderRadius: 18,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: P.onboardTog1,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: P.onboardTog2,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "photos/couple4.jpg",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      fontWeight: 700,
      color: R,
      letterSpacing: 2.5,
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "HECHO PARA LOS DOS"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 25,
      fontWeight: 700,
      color: D,
      lineHeight: 1.1
    }
  }, "Mucho m\xE1s que", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: B
    }
  }, "7 aventuras."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      marginTop: 13
    }
  }, features.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      background: 'white',
      borderRadius: 13,
      padding: '10px 13px',
      border: `1.5px solid ${L}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: `${f.color}18`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      flexShrink: 0
    }
  }, f.ic), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      fontWeight: 600,
      color: D,
      marginBottom: 1
    }
  }, f.title), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 11,
      color: G,
      lineHeight: 1.5
    }
  }, f.desc))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 12,
      flexShrink: 0
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      height: 4,
      width: i === 2 ? 22 : 8,
      borderRadius: 2,
      background: i === 2 ? B : L
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 14,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    label: "Siguiente \u2192",
    bg: B,
    onClick: onNext
  })));
};

// ════════════════════════════════════════════════════════════
// MISIÓN REVEAL — El regalo (arranca el contador de 7 días)
// ════════════════════════════════════════════════════════════
const ScreenMisionReveal = ({
  onStart,
  onBack,
  started = false
}) => /*#__PURE__*/React.createElement(Screen, {
  bg: D,
  dark: true
}, /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(8px + env(safe-area-inset-top)) 22px 24px',
    position: 'relative',
    overflow: 'auto'
  }
}, /*#__PURE__*/React.createElement("img", {
  src: P.splashBg,
  style: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center top',
    opacity: 0.1
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(13,13,24,0.3) 0%, rgba(13,13,24,0.85) 100%)'
  }
}), onBack && /*#__PURE__*/React.createElement("button", {
  onClick: onBack,
  style: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 99,
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    ...mn,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer'
  }
}, /*#__PURE__*/React.createElement("span", null, "\u2190"), /*#__PURE__*/React.createElement("span", null, "el camino")), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 26,
    fontWeight: 700,
    color: Y,
    letterSpacing: -1
  }
}, "ari")), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    flexShrink: 0,
    marginTop: 10
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 99,
    padding: '5px 14px',
    border: '1px solid rgba(255,255,255,0.1)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: R,
    boxShadow: `0 0 8px ${R}`
  }
}), /*#__PURE__*/React.createElement("span", {
  style: {
    ...mn,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  }
}, "tu primera misi\xF3n"))), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    marginTop: 14,
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.12)',
    overflow: 'hidden'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    height: 130,
    position: 'relative'
  }
}, /*#__PURE__*/React.createElement("img", {
  src: P.tortuga,
  style: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 42%'
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, transparent 30%, rgba(13,13,24,0.95) 100%)'
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    display: 'flex',
    gap: 5
  }
}, [1, 2, 3, 4, 5, 6, 7].map(n => /*#__PURE__*/React.createElement("div", {
  key: n,
  style: {
    width: 24,
    height: 24,
    borderRadius: 7,
    background: n <= 1 ? Y : 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...mn,
    fontSize: 11,
    fontWeight: 700,
    color: n <= 1 ? D : 'rgba(255,255,255,0.3)',
    border: `1.5px solid ${n <= 1 ? Y : 'rgba(255,255,255,0.08)'}`
  }
}, n)))), /*#__PURE__*/React.createElement("div", {
  style: {
    padding: '16px 18px 20px'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 10,
    color: Y,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 5
  }
}, "misi\xF3n"), /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 22,
    fontWeight: 700,
    color: 'white',
    lineHeight: 1.1,
    letterSpacing: -0.5
  }
}, "Misi\xF3n Tortuga")), /*#__PURE__*/React.createElement("div", {
  style: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: `${Y}18`,
    border: `1.5px solid ${Y}44`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0
  }
}, "\u2726")), /*#__PURE__*/React.createElement("div", {
  style: {
    ...mn,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.7,
    marginBottom: 16
  }
}, "7 d\xEDas \xB7 7 aventuras", /*#__PURE__*/React.createElement("br", null), "dise\xF1adas solo para ti."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap'
  }
}, ['Aventuras juntos', 'chiquititaaa', 'Recuerdos'].map((tag, i) => /*#__PURE__*/React.createElement("div", {
  key: i,
  style: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 99,
    padding: '4px 10px',
    border: '1px solid rgba(255,255,255,0.08)',
    ...mn,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)'
  }
}, tag)))))), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minHeight: 18
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'relative',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("button", {
  onClick: started ? onBack : onStart,
  style: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    background: Y,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...mn,
    fontSize: 16,
    fontWeight: 700,
    color: D,
    boxShadow: `0 4px 24px ${Y}44`,
    cursor: 'pointer'
  }
}, /*#__PURE__*/React.createElement("span", null, started ? 'Volver al camino' : 'Abrir mi misión'), /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 18
  }
}, "\u2726")))));

// ── metadatos de los 7 días (para Home y router) ──
const DAYS = [{
  n: 1,
  photo: P.day1Circle,
  title: 'El Lugar Secreto',
  short: 'Simetría'
}, {
  n: 2,
  photo: P.day2Circle,
  title: 'El Dinosaurio y las Hormigas',
  short: 'Dino'
}, {
  n: 3,
  photo: P.sobresDay3,
  title: 'El Submarino',
  short: 'Submarino'
}, {
  n: 4,
  photo: P.day4Bg,
  title: 'El Día de la Vergüenza',
  short: 'Vergüenza'
}, {
  n: 5,
  photo: P.sobresDay1,
  title: 'Las Nutrias',
  short: 'Las Nutrias'
}, {
  n: 6,
  photo: P.day6Bg,
  title: 'El Día de Mierda',
  short: 'Checklist'
}, {
  n: 7,
  photo: P.sobresDay7,
  title: 'Belisario',
  short: 'Final'
}];

// ════════════════════════════════════════════════════════════
// HOME — El Camino (gating por fecha + cuenta atrás)
// ════════════════════════════════════════════════════════════
const ScreenHome = ({
  state,
  currentDay,
  onOpenDay,
  onOpenCode,
  onOpenTortuga,
  preview = false
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const layout = [{
    x: 64,
    y: 30
  }, {
    x: 240,
    y: 88
  }, {
    x: 72,
    y: 150
  }, {
    x: 248,
    y: 212
  }, {
    x: 64,
    y: 276
  }, {
    x: 240,
    y: 338
  }, {
    x: 152,
    y: 404
  }];
  const statusOf = n => {
    if (state.completed && state.completed[n]) return 'done';
    if (n < currentDay) return 'past'; // desbloqueado, no completado
    if (n === currentDay) return 'today';
    return 'locked';
  };
  const nodes = DAYS.map((d, i) => ({
    ...d,
    ...layout[i],
    st: statusOf(d.n)
  }));
  const curve = (p, n) => {
    const mx = (p.x + n.x) / 2;
    return `C${mx} ${p.y} ${mx} ${n.y} ${n.x} ${n.y}`;
  };
  const full = nodes.map((d, i) => i === 0 ? `M${d.x} ${d.y}` : curve(nodes[i - 1], d)).join(' ');
  const reached = nodes.slice(0, currentDay).map((d, i) => i === 0 ? `M${d.x} ${d.y}` : curve(nodes[i - 1], d)).join(' ');
  const todayDay = DAYS[currentDay - 1];
  const allDone = currentDay >= 7 && state.completed && state.completed[7];
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(10px + env(safe-area-inset-top)) 24px 4px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 26,
      fontWeight: 700,
      color: D
    }
  }, "ari"), /*#__PURE__*/React.createElement(Badge, null, "d\xEDa ", currentDay, " / 7")), onOpenTortuga && /*#__PURE__*/React.createElement("button", {
    onClick: onOpenTortuga,
    style: {
      marginTop: 6,
      background: 'none',
      border: 'none',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      ...mn,
      fontSize: 12,
      color: B,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2190"), /*#__PURE__*/React.createElement("span", null, "misi\xF3n tortuga"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      margin: '0 24px',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 312,
      height: 460,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 312,
      height: 460
    },
    viewBox: "0 0 312 460"
  }, /*#__PURE__*/React.createElement("path", {
    d: full,
    stroke: L,
    strokeWidth: 4,
    strokeDasharray: "10 7",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: reached,
    stroke: B,
    strokeWidth: 4,
    fill: "none",
    strokeLinecap: "round"
  })), nodes.map(d => {
    const isDone = d.st === 'done',
      isToday = d.st === 'today',
      isLocked = d.st === 'locked',
      isPast = d.st === 'past';
    const tappable = !isLocked || preview;
    const sz = isToday ? 62 : 50;
    return /*#__PURE__*/React.createElement("div", {
      key: d.n,
      onClick: tappable ? () => onOpenDay(d.n) : undefined,
      style: {
        position: 'absolute',
        left: d.x,
        top: d.y,
        transform: 'translate(-50%,-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: tappable ? 'pointer' : 'default'
      }
    }, isToday && /*#__PURE__*/React.createElement("div", {
      className: "ari-pulse",
      style: {
        position: 'absolute',
        width: sz + 22,
        height: sz + 22,
        borderRadius: '50%',
        border: `2px dashed ${Y}`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)'
      }
    }), isDone || isPast ? /*#__PURE__*/React.createElement("img", {
      src: d.photo,
      style: {
        width: sz,
        height: sz,
        borderRadius: '50%',
        objectFit: 'cover',
        objectPosition: 'center top',
        border: `3px solid ${isDone ? B : Y}`,
        boxShadow: `0 2px 8px ${B}44`,
        opacity: isPast ? 0.9 : 1
      }
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        width: sz,
        height: sz,
        borderRadius: '50%',
        background: isToday ? Y : 'white',
        border: `2.5px solid ${isToday ? D : L}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, isLocked ? /*#__PURE__*/React.createElement(Lock, {
      size: 16,
      color: L
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: isToday ? 24 : 18
      }
    }, d.n === 7 ? '✨' : '🎯')), /*#__PURE__*/React.createElement("div", {
      style: {
        ...sk,
        fontSize: 13,
        color: isToday ? D : G,
        fontWeight: isToday ? 700 : 400
      }
    }, isToday ? 'hoy !' : `día ${d.n}`));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 8px',
      flexShrink: 0
    }
  }, currentDay < 7 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 4px 8px',
      ...sk,
      fontSize: 15,
      color: G
    }
  }, /*#__PURE__*/React.createElement("span", null, "pr\xF3xima aventura en"), /*#__PURE__*/React.createElement("span", {
    style: {
      ...mn,
      fontSize: 15,
      fontWeight: 700,
      color: R
    }
  }, fmtCountdown(msToMidnight()))), /*#__PURE__*/React.createElement("div", {
    onClick: allDone ? onOpenCode : () => onOpenDay(currentDay),
    style: {
      background: D,
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: `2px solid ${D}`,
      boxShadow: '2px 2px 0 0 #000',
      overflow: 'hidden',
      position: 'relative',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: allDone ? P.sobresDay7 : todayDay.photo,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top',
      opacity: 0.18
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 11,
      overflow: 'hidden',
      flexShrink: 0,
      border: `2px solid ${Y}`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: allDone ? P.sobresDay7 : todayDay.photo,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center top'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...sk,
      fontSize: 13,
      color: 'rgba(255,255,255,0.45)'
    }
  }, allDone ? 'COMPLETADO' : `HOY · DÍA ${currentDay}`), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 15,
      fontWeight: 600,
      color: 'white'
    }
  }, allDone ? 'Ver código final 🔐' : todayDay.title)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      color: Y,
      position: 'relative'
    }
  }, "\u2192"))));
};

// botón fijo inferior para marcar completado
const CompleteBar = ({
  done,
  onToggle,
  labelTodo = 'Marcar como completado',
  labelDone = '✓ Completado',
  bg = B
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    padding: '10px 22px calc(14px + env(safe-area-inset-bottom))',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(Btn, {
  label: done ? labelDone : labelTodo,
  bg: done ? Y : bg,
  color: done ? D : 'white',
  onClick: onToggle
}));

// ════════════════════════════════════════════════════════════
// DÍA 1 — La Simetría Perfecta (foto)
// ════════════════════════════════════════════════════════════
const ScreenDay1 = ({
  api,
  onBack
}) => {
  const photo = api.photos[1];
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.day1Circle,
    pos: "center 20%",
    dayN: 1,
    label: "\uD83D\uDCF8 misi\xF3n",
    color: B,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 22px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: D,
      lineHeight: 1.1,
      marginBottom: 10,
      flexShrink: 0
    }
  }, "La Simetr\xEDa Perfecta"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'white',
      borderRadius: 14,
      padding: '14px 16px',
      border: `1.5px dashed ${L}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...sk,
      fontSize: 16,
      color: '#444',
      lineHeight: 1.75
    }
  }, "\"El mundo tiene simetr\xEDa perfecta escondida en sitios rid\xEDculos.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Encu\xE9ntrala.\""), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 11,
      color: G,
      marginTop: 8
    }
  }, "Foto centrada, real, sin trampa.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(UploadZone, {
    photo: photo,
    onPick: f => api.setPhoto(1, f)
  })), /*#__PURE__*/React.createElement(ProofShare, {
    title: "La Simetr\xEDa Perfecta",
    text: "Mi foto de simetr\xEDa perfecta \uD83D\uDCF8",
    accent: B
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[1],
    onToggle: () => api.toggleDay(1)
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 2 — El Dinosaurio y las Hormigas
// ════════════════════════════════════════════════════════════
const ScreenDay2 = ({
  api,
  onBack
}) => {
  const best = api.scores && api.scores[2] || 0;
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.ctaThumb,
    dayN: 2,
    label: "\uD83C\uDFAE juego",
    color: Y,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 20px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 21,
      fontWeight: 700,
      color: D,
      marginBottom: 5,
      flexShrink: 0
    }
  }, "El Dinosaurio y las Hormigas"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      color: G,
      lineHeight: 1.6,
      marginBottom: 10,
      flexShrink: 0
    }
  }, "Toca la pantalla para saltar. Esquiva las hormigas. Solo cuenta tu mejor marca del d\xEDa."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 14,
      overflow: 'hidden',
      border: `2px solid ${L}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(DinoGame, {
    best: best,
    onResult: sc => api.setBest(2, sc)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      background: W,
      borderRadius: 12,
      padding: '11px 16px',
      border: `1.5px solid ${L}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 9,
      color: G,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 2
    }
  }, "mejor puntuaci\xF3n"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: Y
    }
  }, best)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[2],
    onToggle: () => api.toggleDay(2),
    labelTodo: "\u2713 Registrar mejor marca",
    bg: Y
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 3 — El Submarino (expedición real, regida por el tiempo)
// ════════════════════════════════════════════════════════════
const PHASE_MS = 45 * 60 * 1000; // cada zona dura 45 minutos
const SUB_LEVELS = [{
  dNum: 200,
  m: 'La luz solar desaparece para siempre',
  creature: '🐠',
  color: '#64C8FF',
  zoneName: 'Zona fótica'
}, {
  dNum: 1000,
  m: 'Los cachalotes ya no bajan más. Estás sola',
  creature: '🐋',
  color: '#7B8CDE',
  zoneName: 'Zona batipelágica'
}, {
  dNum: 3800,
  m: 'El Titanic reposa aquí',
  creature: '🐙',
  color: '#9B59B6',
  zoneName: 'Zona abisal'
}, {
  dNum: 6000,
  m: 'Bienvenida a la zona hadal',
  creature: '🦑',
  color: '#6C3483',
  zoneName: 'Zona hadal'
}, {
  dNum: 8849,
  m: 'La cima del Everest quedaría sumergida',
  creature: '🪼',
  color: '#4A235A',
  zoneName: 'Fosa ultraprofunda'
}, {
  dNum: 11034,
  m: 'Challenger Deep. El lugar más silencioso',
  creature: '⭐',
  color: '#5566CC',
  zoneName: 'Challenger Deep'
}];
const fmtDepth = m => String(Math.round(m)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'm';
const ScreenDay3 = ({
  api,
  onBack
}) => {
  const levels = SUB_LEVELS;
  const N = levels.length;
  const speed = (() => {
    const v = parseFloat(new URLSearchParams(location.search).get('expedSpeed'));
    return v > 0 ? v : 1;
  })();
  const startedAt = api.expedition && api.expedition.startedAt;
  const startMs = startedAt ? new Date(startedAt).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const elapsed = startedAt ? Math.max(0, (now - startMs) * speed) : 0;
  const phaseFloat = Math.min(N, elapsed / PHASE_MS);
  const finished = phaseFloat >= N;
  const idx = finished ? N - 1 : Math.floor(phaseFloat);
  const progress = finished ? 1 : phaseFloat - idx;

  // profundidad interpolada con el tiempo
  let curDepth = 0;
  if (startedAt) {
    const from = levels[idx].dNum;
    const to = levels[Math.min(idx + 1, N - 1)].dNum;
    curDepth = finished ? levels[N - 1].dNum : from + (to - from) * progress;
  }
  let nextCountdown = null;
  if (startedAt && !finished) {
    nextCountdown = fmtCountdown(((idx + 1) * PHASE_MS - elapsed) / speed);
  }
  const statusOf = i => {
    if (!startedAt) return 'locked';
    if (i < idx) return 'done';
    if (i === idx) return 'current';
    return 'locked';
  };
  return /*#__PURE__*/React.createElement(Screen, {
    bg: "#06101a",
    dark: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: '0 0 20px 20px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(HifiSubCanvas, {
    level: startedAt ? phaseFloat : 0
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      position: 'absolute',
      top: 'calc(12px + env(safe-area-inset-top))',
      left: 18,
      width: 38,
      height: 38,
      borderRadius: 12,
      background: 'rgba(0,0,0,0.4)',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...mn,
      fontSize: 17,
      color: 'white',
      cursor: 'pointer'
    }
  }, "\u2190")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 18px 0',
      overflow: 'auto'
    }
  }, !startedAt ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 13,
      padding: '16px 16px',
      marginBottom: 7,
      border: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 9,
      color: 'rgba(100,160,255,0.8)',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "expedici\xF3n a la fosa de las marianas"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 18,
      fontWeight: 700,
      color: 'white',
      lineHeight: 1.2,
      marginBottom: 6
    }
  }, "Desciende al punto m\xE1s profundo del planeta"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 11,
      color: 'rgba(255,255,255,0.45)',
      lineHeight: 1.6,
      marginBottom: 14
    }
  }, "6 zonas \xB7 cada una se desbloquea a los 45 minutos. El submarino baja en tiempo real y vas viendo lo que habita cada profundidad."), /*#__PURE__*/React.createElement(Btn, {
    label: "Comenzar expedici\xF3n \u2193",
    bg: "#3a5a8a",
    onClick: () => api.startExpedition()
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 13,
      padding: '11px 14px',
      marginBottom: 7,
      border: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 9,
      color: 'rgba(100,160,255,0.8)',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 3
    }
  }, "profundidad actual"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 24,
      fontWeight: 700,
      color: 'white',
      letterSpacing: -1
    }
  }, fmtDepth(curDepth)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 2
    }
  }, levels[idx].m)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 9,
      color: 'rgba(255,255,255,0.3)',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 3
    }
  }, finished ? 'estado' : 'próxima zona en'), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 16,
      fontWeight: 700,
      color: 'rgba(100,160,255,0.9)'
    }
  }, finished ? 'fondo alcanzado' : nextCountdown))), !finished && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9,
      height: 5,
      borderRadius: 3,
      background: 'rgba(255,255,255,0.07)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.round(progress * 100)}%`,
      background: 'linear-gradient(90deg, #3a5a8a, #9B59B6)',
      borderRadius: 3
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, levels.map((l, i) => {
    const st = statusOf(i);
    const isDone = st === 'done',
      isCur = st === 'current';
    const active = isDone || isCur;
    const darkness = 0.03 + i * 0.015;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: isCur ? 'linear-gradient(135deg, rgba(50,80,160,0.2) 0%, rgba(80,40,120,0.12) 100%)' : isDone ? 'rgba(50,80,160,0.08)' : `rgba(255,255,255,${darkness})`,
        borderRadius: 12,
        padding: '8px 11px',
        border: `1.5px solid ${isCur ? 'rgba(100,130,255,0.3)' : isDone ? 'rgba(80,120,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
        opacity: active ? 1 : 0.35,
        transition: 'opacity 0.6s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 30,
        height: 30,
        borderRadius: 10,
        background: active ? `${l.color}22` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${active ? l.color + '44' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        flexShrink: 0
      }
    }, isDone ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: l.color
      }
    }, "\u2713") : isCur ? /*#__PURE__*/React.createElement("span", null, l.creature) : /*#__PURE__*/React.createElement(Lock, {
      size: 13,
      color: "rgba(255,255,255,0.25)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 13,
        fontWeight: 700,
        color: isDone ? l.color : isCur ? 'white' : 'rgba(255,255,255,0.4)'
      }
    }, fmtDepth(l.dNum)), /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 8,
        color: active ? `${l.color}88` : 'rgba(255,255,255,0.15)',
        letterSpacing: 1,
        textTransform: 'uppercase'
      }
    }, l.zoneName)), /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 9,
        color: 'rgba(255,255,255,0.3)',
        lineHeight: 1.4,
        marginTop: 1
      }
    }, l.m)), isCur && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: l.color,
        boxShadow: `0 0 8px ${l.color}`,
        flexShrink: 0
      }
    }));
  })), finished && !api.completed[3] && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      background: 'rgba(85,102,204,0.12)',
      borderRadius: 12,
      padding: '10px 13px',
      border: '1px solid rgba(100,130,255,0.25)',
      ...mn,
      fontSize: 11,
      color: 'rgba(200,215,255,0.85)',
      lineHeight: 1.55,
      flexShrink: 0
    }
  }, "Has llegado al Challenger Deep. Ya puedes marcar el d\xEDa como completado. \uD83C\uDF0A"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[3],
    onToggle: () => api.toggleDay(3),
    bg: "#3a5a8a"
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 4 — El Día de la Vergüenza
// ════════════════════════════════════════════════════════════
const ScreenDay4 = ({
  api,
  onBack
}) => {
  const challenges = [{
    id: 'a',
    emoji: '🎵',
    title: 'Canta una frase',
    desc: 'Consigue que un desconocido cante una frase de su canción favorita. Grábalo.'
  }, {
    id: 'b',
    emoji: '📹',
    title: 'Vídeo motivacional',
    desc: 'Haz que un desconocido te grabe un vídeo motivacional (máx 30 segundos).'
  }, {
    id: 'c',
    emoji: '📚',
    title: 'Recomendación de libro',
    desc: 'Consigue que alguien te recomiende un libro. Pregunta por qué le gustó.'
  }];
  const checks = api.checks[4] || {};
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.day4Bg,
    dayN: 4,
    label: "\uD83D\uDE33 verg\xFCenza",
    color: R,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 22px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: D,
      marginBottom: 4,
      flexShrink: 0
    }
  }, "El D\xEDa de la Verg\xFCenza"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      color: G,
      marginBottom: 12,
      flexShrink: 0
    }
  }, "Tres retos en la calle con desconocidos. Sin filtro."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, challenges.map((ch, i) => {
    const done = !!checks[ch.id];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => api.toggleCheck(4, ch.id),
      style: {
        background: 'white',
        borderRadius: 14,
        border: `1.5px solid ${done ? R : L}`,
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: `${R}08`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 24
      }
    }, ch.emoji), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 13,
        fontWeight: 600,
        color: D
      }
    }, "Reto ", i + 1), /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 12,
        color: R,
        fontWeight: 700
      }
    }, "en la calle")), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        background: done ? R : 'white',
        border: `1.5px solid ${done ? R : L}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'white'
      }
    }, "\u2713"))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 13,
        fontWeight: 600,
        color: D,
        marginBottom: 6
      }
    }, ch.title), /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 12,
        color: G,
        lineHeight: 1.6
      }
    }, ch.desc), /*#__PURE__*/React.createElement(ProofShare, {
      title: "Reto \xB7 D\xEDa de la Verg\xFCenza",
      text: `Prueba del reto: ${ch.title}`,
      accent: R
    })));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[4],
    onToggle: () => api.toggleDay(4),
    bg: R
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 5 — Las Nutrias (escribir)
// ════════════════════════════════════════════════════════════
const ScreenDay5 = ({
  api,
  onBack
}) => {
  const text = api.texts[5] || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const enough = words >= 40;
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.sobresDay1,
    dayN: 5,
    label: "\uD83D\uDE02 escribe",
    color: R,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 22px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: D,
      lineHeight: 1.1,
      marginBottom: 8,
      flexShrink: 0
    }
  }, "Las Nutrias"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      color: G,
      lineHeight: 1.7,
      marginBottom: 10,
      flexShrink: 0
    }
  }, "Escribe un poema sobre las nutrias cuando se van a dormir \xB7 M\xEDnimo 40 palabras"), /*#__PURE__*/React.createElement("textarea", {
    value: text,
    onChange: e => api.setText(5, e.target.value),
    placeholder: "Se dan la mano bajo el agua para no perderse...",
    style: {
      minHeight: 150,
      background: 'white',
      borderRadius: 16,
      padding: '13px 15px',
      border: `1.5px solid ${B}`,
      ...sk,
      fontSize: 16,
      color: '#444',
      lineHeight: 1.8,
      resize: 'vertical',
      outline: 'none',
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      color: B
    }
  }, words, " palabras", enough ? ' · ¡listo!' : ` · faltan ${40 - words}`), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      color: G
    }
  }, "mod 10 \u2192 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: Y,
      fontWeight: 700
    }
  }, words % 10))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[5],
    onToggle: () => enough && api.toggleDay(5),
    labelTodo: enough ? 'Enviar mi poema' : 'Escribe 40 palabras',
    bg: enough ? B : L
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 6 — El Día de Mierda (checklist)
// ════════════════════════════════════════════════════════════
const ScreenDay6 = ({
  api,
  onBack
}) => {
  const tasks = [{
    id: 'a',
    label: '50 sentadillas. Exactamente 50. Sin música.'
  }, {
    id: 'b',
    label: '1 minuto de plancha. Si fallas, 30s de descanso y repites.'
  }, {
    id: 'c',
    label: 'Sube a algún sitio alto hoy. Foto desde arriba.'
  }, {
    id: 'd',
    label: 'Da una vuelta a la manzana: 20 minutos caminando. Sin música ni móvil.'
  }];
  const checks = api.checks[6] || {};
  const doneCount = tasks.filter(t => checks[t.id]).length;
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.day6Bg,
    dayN: 6,
    label: "\uD83D\uDCAA retos",
    color: Y,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 22px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: D,
      marginBottom: 4,
      flexShrink: 0
    }
  }, "El D\xEDa de Mierda"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      color: G,
      marginBottom: 14,
      flexShrink: 0
    }
  }, "Hoy no hay preguntas. Solo esto:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, tasks.map(t => {
    const done = !!checks[t.id];
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      style: {
        background: done ? `${Y}10` : 'white',
        borderRadius: 14,
        padding: '13px 14px',
        border: `1.5px solid ${done ? Y + '44' : L}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => api.toggleCheck(6, t.id),
      style: {
        display: 'flex',
        gap: 13,
        alignItems: 'flex-start',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 26,
        height: 26,
        borderRadius: 8,
        background: done ? Y : W,
        border: `1.5px solid ${done ? Y : L}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: D
      }
    }, "\u2713")), /*#__PURE__*/React.createElement("div", {
      style: {
        ...mn,
        fontSize: 13,
        color: done ? G : D,
        lineHeight: 1.55,
        textDecoration: done ? 'line-through' : 'none',
        paddingTop: 2
      }
    }, t.label)), /*#__PURE__*/React.createElement(ProofShare, {
      title: "Reto \xB7 D\xEDa de Mierda",
      text: `Prueba del reto: ${t.label}`,
      accent: Y
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: W,
      borderRadius: 12,
      padding: '11px 15px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: `1.5px solid ${L}`,
      marginTop: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      color: G
    }
  }, "completadas \xB7 D4 del c\xF3digo"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 26,
      fontWeight: 700,
      color: doneCount === 4 ? Y : G
    }
  }, doneCount, " / 4")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[6],
    onToggle: () => api.toggleDay(6),
    bg: Y,
    labelTodo: "Marcar d\xEDa completado"
  }));
};

// ════════════════════════════════════════════════════════════
// DÍA 7 — Belisario (historia + outfit)
// ════════════════════════════════════════════════════════════
const ScreenDay7 = ({
  api,
  onBack
}) => {
  const photo = api.photos[7];
  return /*#__PURE__*/React.createElement(Screen, {
    bg: W
  }, /*#__PURE__*/React.createElement(DayHeader, {
    src: P.sobresDay7,
    dayN: 7,
    label: "\uD83D\uDC51 final",
    color: Y,
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 22px 0',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 22,
      fontWeight: 700,
      color: D,
      lineHeight: 1.1,
      marginBottom: 12
    }
  }, "Belisario"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...sk,
      fontSize: 15,
      color: '#555',
      lineHeight: 1.85
    }
  }, ['Imagina que estamos en el año 527 d.C.. En Constantinopla acaba de subir al trono un emperador llamado Justiniano I. Su sueño parece una locura: reconstruir el antiguo Imperio Romano. Hacía más de cincuenta años que Roma había caído en Occidente y gran parte de Europa estaba gobernada por pueblos bárbaros. Casi nadie creía que aquel sueño pudiera hacerse realidad. Sin embargo, Justiniano tenía un arma secreta: un joven general llamado Belisario.', 'Belisario no provenía de una familia poderosa. Había nacido alrededor del año 500 d.C. en una región cercana a los Balcanes y había comenzado su carrera como simple soldado. Lo que le diferenciaba era su capacidad para mantener la calma cuando todos los demás entraban en pánico. Era el tipo de persona que, cuando veía un problema enorme, en lugar de asustarse empezaba a pensar cómo aprovecharlo a su favor.', 'Su primer gran momento llegó en el año 530, en la famosa batalla de Dara contra los persas. Los enemigos superaban en número a los romanos y estaban convencidos de que ganarían fácilmente. Belisario ordenó cavar trincheras, colocó a sus tropas en posiciones cuidadosamente estudiadas y preparó una emboscada. Cuando comenzó la batalla, los persas cayeron exactamente donde él quería. La victoria fue tan sorprendente que empezó a ser considerado uno de los mejores estrategas de su tiempo.', 'Dos años después, en 532, ocurrió algo aún más dramático. Constantinopla estalló en llamas durante la Revuelta de Niká. Decenas de miles de personas se rebelaron contra Justiniano, incendiaron edificios y proclamaron un nuevo emperador. La situación era tan grave que Justiniano estaba dispuesto a huir de la ciudad. Entonces intervino Belisario. Con un pequeño grupo de soldados entró en el Hipódromo, donde se concentraban los rebeldes, y sofocó la revuelta. Según algunas crónicas, murieron más de 30.000 personas aquel día. Fue un episodio terrible, pero salvó al imperio de una posible caída.', 'Después de aquello llegó la misión que parecía imposible. En 533, Justiniano envió a Belisario a conquistar el reino vándalo en el norte de África. Lo curioso es que Belisario cruzó el Mediterráneo con apenas unos 15.000 soldados, una fuerza muy pequeña para la tarea que tenía por delante. Contra todo pronóstico derrotó a los vándalos en las batallas de Ad Decimum y Tricamarum y conquistó Cartago. En menos de un año había destruido un reino que llevaba casi un siglo gobernando la región.', 'Pero su aventura más famosa comenzó en 535, cuando desembarcó en Italia para enfrentarse a los ostrogodos. Fue entonces cuando recuperó ciudades históricas como Nápoles y finalmente entró en Roma. Sin embargo, conquistar la ciudad era solo el principio. Poco después, un enorme ejército ostrogodo la rodeó. Durante más de un año Belisario defendió Roma con muchos menos hombres que sus enemigos. Hay una anécdota muy famosa de aquella época: cuando algunos soldados le sugirieron retirarse porque la situación era desesperada, Belisario respondió que mientras quedara una muralla en pie seguiría defendiendo la ciudad. Verdadera o no, la historia refleja perfectamente la reputación que tenía.', 'A medida que acumulaba victorias ocurrió algo curioso. Los enemigos de Roma empezaron a admirarlo. En 540, cuando conquistó la ciudad de Rávena, los propios ostrogodos le ofrecieron convertirse en rey de Italia. Imagínate la situación: un general extranjero llega a tu país, te derrota y acabas ofreciéndole la corona. Casi cualquier persona habría aceptado. Belisario fingió estar de acuerdo para evitar una batalla final, pero una vez dentro de la ciudad anunció que seguía siendo leal a Justiniano y entregó Italia al imperio. Rechazó un reino entero.', 'Sin embargo, cuanto más éxito tenía, más desconfiaba Justiniano de él. El emperador empezó a preguntarse si algún día Belisario podría utilizar su popularidad para quitarle el trono. Por eso le retiró soldados, recursos y poder político en varias ocasiones. Aun así, cada vez que el imperio estaba en peligro, volvía a llamarlo. Era como si Justiniano no terminara de confiar en él, pero tampoco pudiera vivir sin él.', 'En sus últimos años, Belisario siguió defendiendo el imperio contra persas y otros invasores. Una de las leyendas más famosas cuenta que acabó ciego y mendigando por las calles mientras decía: \u201cDad una moneda a Belisario\u201d. Hoy sabemos que probablemente esa historia es falsa, pero fue tan popular durante siglos que inspiró cuadros, novelas y obras de teatro. La gente la contaba porque veía en Belisario al héroe injustamente tratado después de haber salvado a su país.', 'Cuando murió alrededor del año 565, el mismo año que Justiniano, dejaba tras de sí una carrera extraordinaria. Había derrotado a persas, vándalos y ostrogodos; había recuperado enormes territorios para Roma; había rechazado una corona y había permanecido fiel a su emperador a pesar de las sospechas. Por eso muchos historiadores lo consideran uno de los generales más brillantes de todos los tiempos. Su historia no es solo la de un gran militar, sino la de un hombre que tuvo la oportunidad de convertirse en rey y prefirió seguir siendo soldado. En una época llena de traiciones y ambiciones, esa decisión fue quizá su victoria más impresionante. \u2694\ufe0f\ud83c\udfdb\ufe0f\ud83d\udcdc'].map((p, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: '0 0 14px'
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1.5px solid ${L}`,
      paddingTop: 14,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: Y + '10',
      borderRadius: 16,
      padding: '14px 15px',
      border: `1.5px solid ${Y}44`,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 12,
      fontWeight: 700,
      color: '#b89400',
      marginBottom: 8
    }
  }, "Tu misi\xF3n final:"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 13,
      color: D,
      lineHeight: 1.7
    }
  }, "Arma un outfit con tu ropa lo m\xE1s parecido posible a Belisario. T\xFAnica, capa, corona improvisada, lo que tengas. Que se vea como un general romano.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 280,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 12,
      border: `2px solid ${L}`,
      background: D,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "photos/belisario.png",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      objectPosition: 'center'
    }
  })), /*#__PURE__*/React.createElement(UploadZone, {
    photo: photo,
    onPick: f => api.setPhoto(7, f),
    height: 150,
    hint: "sube tu foto aqu\xED"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...sk,
      fontSize: 13,
      color: G,
      textAlign: 'center'
    }
  }, "este es tu \xFAltimo reto \uD83D\uDC51"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  }))), /*#__PURE__*/React.createElement(CompleteBar, {
    done: !!api.completed[7],
    onToggle: () => api.toggleDay(7),
    bg: Y,
    labelTodo: "Completar mi misi\xF3n final"
  }));
};

// ════════════════════════════════════════════════════════════
// FINAL — Código de desbloqueo
// ════════════════════════════════════════════════════════════
const ScreenCodeFinal = ({
  api,
  onBack
}) => {
  const frozen = Array.isArray(api.finalCode) && api.finalCode.length === CODE_LEN;
  const code = frozen ? api.finalCode : codeFromAnswers(api);
  const completedCount = Object.values(api.completed).filter(Boolean).length;
  const HIDDEN_TAIL = 2; // los dos últimos siempre quedan como incógnita
  const maxVisible = code.length - HIDDEN_TAIL;
  const visibleCount = Math.min(maxVisible, frozen ? maxVisible : Math.max(0, completedCount));
  return /*#__PURE__*/React.createElement(Screen, {
    bg: D,
    dark: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '20%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      width: 300,
      height: 300,
      background: `radial-gradient(circle, ${Y}15 0%, transparent 70%)`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      position: 'absolute',
      top: 'calc(14px + env(safe-area-inset-top))',
      left: 18,
      width: 38,
      height: 38,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.08)',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...mn,
      fontSize: 17,
      color: 'white',
      cursor: 'pointer',
      zIndex: 2
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 26px',
      position: 'relative',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 36,
      fontWeight: 700,
      color: Y,
      letterSpacing: -2,
      textShadow: `0 0 40px ${Y}44`
    }
  }, "ari"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 1.5,
      background: Y,
      borderRadius: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...mn,
      fontSize: 10,
      color: Y,
      letterSpacing: 4,
      textTransform: 'uppercase'
    }
  }, "c\xF3digo final"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 1.5,
      background: Y,
      borderRadius: 1
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, code.map((n, i) => {
    const visible = i < visibleCount;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        width: 44,
        height: 56,
        borderRadius: 12,
        background: visible ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${visible ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...mn,
        fontSize: 28,
        fontWeight: 700,
        color: visible ? 'white' : 'rgba(255,255,255,0.12)'
      }
    }, visible ? n : '?');
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 4
    }
  }, [1, 2, 3, 4, 5, 6, 7].map(n => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      width: n === 7 ? 20 : 8,
      height: 4,
      borderRadius: 2,
      background: n <= completedCount ? Y : 'rgba(255,255,255,0.1)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 16,
      padding: '18px 20px',
      border: '1px solid rgba(255,255,255,0.08)',
      textAlign: 'center',
      maxWidth: 280
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...sk,
      fontSize: 15,
      color: 'rgba(255,255,255,0.5)',
      lineHeight: 1.9
    }
  }, frozen ? /*#__PURE__*/React.createElement(React.Fragment, null, "Has completado los 7 d\xEDas.", /*#__PURE__*/React.createElement("br", null), "Tus respuestas crearon el c\xF3digo.", /*#__PURE__*/React.createElement("br", null), "Los dos \xFAltimos son una inc\xF3gnita \uD83D\uDC40") : /*#__PURE__*/React.createElement(React.Fragment, null, "Cada d\xEDa que completas", /*#__PURE__*/React.createElement("br", null), "construye tu c\xF3digo final.", /*#__PURE__*/React.createElement("br", null), "Llevas ", completedCount, " de 7."))))));
};

// ════════════════════════════════════════════════════════════
// APP — router + estado
// ════════════════════════════════════════════════════════════
const App = () => {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState('splash');
  const [day, setDay] = useState(1);

  // persistir cada cambio
  useEffect(() => {
    saveState(state);
  }, [state]);

  // tras el splash → home u onboarding
  useEffect(() => {
    const id = setTimeout(() => {
      setView(state.onboardingDone ? 'home' : 'onboard0');
    }, 1900);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, []);

  // día actual (override por ?day=N para previsualizar)
  const params = new URLSearchParams(location.search);
  const override = parseInt(params.get('day'), 10);
  const previewAll = DEV_UNLOCK_ALL || params.get('preview') === '1';
  const realDay = computeCurrentDay(state.startDate);
  const currentDay = previewAll ? 7 : override >= 1 && override <= 7 ? override : realDay;
  const completed = state.completed || {};
  const photos = state.photos || {};
  const texts = state.texts || {};
  const checks = state.checks || {};
  const scores = state.scores || {};
  const expedition = state.expedition || {};
  const api = {
    completed,
    photos,
    texts,
    checks,
    scores,
    expedition,
    finalCode: state.finalCode,
    toggleDay: n => setState(s => ({
      ...s,
      completed: {
        ...(s.completed || {}),
        [n]: !(s.completed && s.completed[n])
      }
    })),
    toggleCheck: (d, id) => setState(s => {
      const c = {
        ...(s.checks || {})
      };
      const dd = {
        ...(c[d] || {})
      };
      dd[id] = !dd[id];
      c[d] = dd;
      return {
        ...s,
        checks: c
      };
    }),
    setText: (n, t) => setState(s => ({
      ...s,
      texts: {
        ...(s.texts || {}),
        [n]: t
      }
    })),
    setPhoto: async (n, file) => {
      try {
        const url = await downscaleImage(file);
        setState(s => ({
          ...s,
          photos: {
            ...(s.photos || {}),
            [n]: url
          }
        }));
      } catch (e) {}
    },
    setBest: (n, val) => setState(s => {
      const sc = {
        ...(s.scores || {})
      };
      if (!(sc[n] >= val)) sc[n] = val;else return s;
      return {
        ...s,
        scores: sc
      };
    }),
    startExpedition: () => setState(s => s.expedition && s.expedition.startedAt ? s : {
      ...s,
      expedition: {
        ...(s.expedition || {}),
        startedAt: new Date().toISOString()
      }
    })
  };

  // congela el código final una sola vez, cuando ari completa los 7 días
  const allDone = [1, 2, 3, 4, 5, 6, 7].every(n => completed[n]);
  useEffect(() => {
    if (allDone && !(Array.isArray(state.finalCode) && state.finalCode.length === CODE_LEN)) {
      setState(s => ({
        ...s,
        finalCode: codeFromAnswers(s)
      }));
    }
  }, [allDone, state.finalCode]);
  const startMission = () => {
    setState(s => ({
      ...s,
      onboardingDone: true,
      startDate: s.startDate || new Date().toISOString()
    }));
    setView('home');
  };
  const openDay = n => {
    if (n >= 1 && n <= 7 && (previewAll || n <= currentDay)) {
      setDay(n);
      setView('day');
    }
  };

  // render
  let content;
  if (view === 'splash') content = /*#__PURE__*/React.createElement(ScreenSplash, null);else if (view === 'onboard0') content = /*#__PURE__*/React.createElement(ScreenOnboard, {
    onNext: () => setView('onboard1')
  });else if (view === 'onboard1') content = /*#__PURE__*/React.createElement(ScreenOnboardMemories, {
    onNext: () => setView('onboard2')
  });else if (view === 'onboard2') content = /*#__PURE__*/React.createElement(ScreenOnboardTogether, {
    onNext: () => setView('reveal')
  });else if (view === 'reveal') content = /*#__PURE__*/React.createElement(ScreenMisionReveal, {
    onStart: startMission,
    onBack: state.onboardingDone ? () => setView('home') : undefined,
    started: !!state.onboardingDone
  });else if (view === 'home') content = /*#__PURE__*/React.createElement(ScreenHome, {
    state: state,
    currentDay: currentDay,
    onOpenDay: openDay,
    onOpenCode: () => setView('code'),
    onOpenTortuga: () => setView('reveal'),
    preview: previewAll
  });else if (view === 'code') content = /*#__PURE__*/React.createElement(ScreenCodeFinal, {
    api: api,
    onBack: () => setView('home')
  });else if (view === 'day') {
    const back = () => setView('home');
    const map = {
      1: ScreenDay1,
      2: ScreenDay2,
      3: ScreenDay3,
      4: ScreenDay4,
      5: ScreenDay5,
      6: ScreenDay6,
      7: ScreenDay7
    };
    const C = map[day] || ScreenDay1;
    content = /*#__PURE__*/React.createElement(C, {
      api: api,
      onBack: back
    });
  } else content = /*#__PURE__*/React.createElement(ScreenSplash, null);
  return content;
};
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));

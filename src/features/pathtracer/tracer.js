// Monte Carlo path tracer — built from scratch (no Blender, no external API).
// Real physically-based rendering: ray-sphere intersection, Lambertian diffuse,
// metal (reflection), dielectric (refraction via Snell's law + Schlick Fresnel),
// global illumination by recursively bouncing rays and sampling a sky light, and
// soft shadows that fall out of the path integral for free.
//
// Pure and self-contained so it can run inside a worker thread. renderRGBA()
// returns a Uint8ClampedArray (RGBA) ready for a canvas.

// ---- vec3 helpers (plain [x,y,z] arrays for speed) ----
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function randUnitVec() {
  // Uniform direction on the unit sphere.
  const z = 2 * Math.random() - 1;
  const t = 2 * Math.PI * Math.random();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}
const reflect = (v, n) => sub(v, scale(n, 2 * dot(v, n)));
function refract(uv, n, etaRatio) {
  const cosT = Math.min(dot(scale(uv, -1), n), 1);
  const perp = scale(add(uv, scale(n, cosT)), etaRatio);
  const parl = scale(n, -Math.sqrt(Math.abs(1 - dot(perp, perp))));
  return add(perp, parl);
}
const schlick = (cos, ref) => { let r0 = (1 - ref) / (1 + ref); r0 *= r0; return r0 + (1 - r0) * Math.pow(1 - cos, 5); };

// ---- ray-sphere intersection ----
function hitSphere(s, ro, rd, tmin, tmax) {
  const oc = sub(ro, s.center);
  const a = dot(rd, rd);
  const halfB = dot(oc, rd);
  const c = dot(oc, oc) - s.radius * s.radius;
  const disc = halfB * halfB - a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-halfB - sq) / a;
  if (t < tmin || t > tmax) { t = (-halfB + sq) / a; if (t < tmin || t > tmax) return null; }
  const p = add(ro, scale(rd, t));
  let n = scale(sub(p, s.center), 1 / s.radius);
  const front = dot(rd, n) < 0;
  if (!front) n = scale(n, -1);
  return { t, p, n, front, mat: s.material };
}

function hitWorld(spheres, ro, rd) {
  let best = null; let closest = Infinity;
  for (const s of spheres) { const h = hitSphere(s, ro, rd, 0.001, closest); if (h) { best = h; closest = h.t; } }
  return best;
}

function skyColor(rd) {
  const t = 0.5 * (unit(rd)[1] + 1);
  return add(scale([1, 1, 1], 1 - t), scale([0.5, 0.7, 1.0], t)); // white → sky blue (the area light)
}

// Recursive path trace: returns the radiance along the ray.
function rayColor(ro, rd, spheres, depth) {
  if (depth <= 0) return [0, 0, 0];
  const h = hitWorld(spheres, ro, rd);
  if (!h) return skyColor(rd);
  const m = h.mat;

  if (m.type === 'metal') {
    let dir = reflect(unit(rd), h.n);
    if (m.fuzz) dir = add(dir, scale(randUnitVec(), m.fuzz));
    if (dot(dir, h.n) <= 0) return [0, 0, 0];
    return mul(m.albedo, rayColor(h.p, dir, spheres, depth - 1));
  }
  if (m.type === 'dielectric') {
    const ir = m.ior || 1.5;
    const ratio = h.front ? 1 / ir : ir;
    const u = unit(rd);
    const cosT = Math.min(dot(scale(u, -1), h.n), 1);
    const sinT = Math.sqrt(1 - cosT * cosT);
    const dir = (ratio * sinT > 1 || schlick(cosT, ratio) > Math.random())
      ? reflect(u, h.n)
      : refract(u, h.n, ratio);
    return rayColor(h.p, dir, spheres, depth - 1); // glass barely tints
  }
  // Lambertian diffuse (default): scatter toward a random hemisphere direction.
  let dir = add(h.n, randUnitVec());
  if (Math.abs(dir[0]) < 1e-8 && Math.abs(dir[1]) < 1e-8 && Math.abs(dir[2]) < 1e-8) dir = h.n;
  return mul(m.albedo, rayColor(h.p, dir, spheres, depth - 1));
}

// ---- camera + render ----
export function renderRGBA(scene, { width = 400, height = 225, samples = 12, depth = 12 } = {}) {
  const spheres = scene.spheres;
  const cam = scene.camera;
  const lookfrom = cam.lookfrom || [0, 1, 4];
  const lookat = cam.lookat || [0, 0, -1];
  const vfov = ((cam.vfov || 40) * Math.PI) / 180;
  const aspect = width / height;

  const h = Math.tan(vfov / 2);
  const vpH = 2 * h; const vpW = aspect * vpH;
  const w = unit(sub(lookfrom, lookat));
  const u = unit(cross([0, 1, 0], w));
  const v = cross(w, u);
  const horiz = scale(u, vpW);
  const vert = scale(v, vpH);
  const lowerLeft = sub(sub(sub(lookfrom, scale(horiz, 0.5)), scale(vert, 0.5)), w);

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let col = [0, 0, 0];
      for (let s = 0; s < samples; s++) {
        const sx = (x + Math.random()) / (width - 1);
        const sy = (y + Math.random()) / (height - 1);
        const target = add(add(lowerLeft, scale(horiz, sx)), scale(vert, sy));
        const rd = sub(target, lookfrom);
        col = add(col, rayColor(lookfrom, rd, spheres, depth));
      }
      // average + gamma 2.0
      const r = Math.sqrt(col[0] / samples);
      const g = Math.sqrt(col[1] / samples);
      const b = Math.sqrt(col[2] / samples);
      const i = ((height - 1 - y) * width + x) * 4; // flip Y for image coords
      out[i] = r * 255; out[i + 1] = g * 255; out[i + 2] = b * 255; out[i + 3] = 255;
    }
  }
  return out;
}

// ---- built-in scenes ----
export function presetScene(name = 'showcase') {
  const ground = { center: [0, -1000.5, -1], radius: 1000, material: { type: 'lambert', albedo: [0.5, 0.5, 0.5] } };
  if (name === 'glass') {
    return {
      camera: { lookfrom: [0, 1, 4], lookat: [0, 0, -1], vfov: 40 },
      spheres: [ground,
        { center: [0, 0, -1], radius: 0.5, material: { type: 'dielectric', ior: 1.5 } },
        { center: [-1.1, 0, -1], radius: 0.5, material: { type: 'metal', albedo: [0.8, 0.8, 0.9], fuzz: 0.0 } },
        { center: [1.1, 0, -1], radius: 0.5, material: { type: 'lambert', albedo: [0.9, 0.3, 0.3] } }],
    };
  }
  if (name === 'random') {
    const spheres = [ground];
    const mats = [
      () => ({ type: 'lambert', albedo: [Math.random(), Math.random(), Math.random()] }),
      () => ({ type: 'metal', albedo: [0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5], fuzz: Math.random() * 0.3 }),
      () => ({ type: 'dielectric', ior: 1.5 }),
    ];
    for (let k = 0; k < 6; k++) {
      spheres.push({ center: [(Math.random() - 0.5) * 4, 0, -1 - Math.random() * 2.5], radius: 0.3 + Math.random() * 0.25, material: mats[k % 3]() });
    }
    return { camera: { lookfrom: [0, 1.2, 4], lookat: [0, 0, -1.5], vfov: 45 }, spheres };
  }
  // showcase: the classic three-ball scene
  return {
    camera: { lookfrom: [-2, 1.5, 3], lookat: [0, 0, -1], vfov: 45 },
    spheres: [ground,
      { center: [0, 0, -1], radius: 0.5, material: { type: 'lambert', albedo: [0.7, 0.3, 0.3] } },
      { center: [-1, 0, -1], radius: 0.5, material: { type: 'dielectric', ior: 1.5 } },
      { center: [1, 0, -1], radius: 0.5, material: { type: 'metal', albedo: [0.8, 0.6, 0.2], fuzz: 0.05 } }],
  };
}

#!/usr/bin/env node
// Typed path-tracer scene validator (TypeScript).
//
// Catches bad scene JSON *before* you hand it to `!render`, with real static
// types: a discriminated union for materials, a Vec3 type guard, and strict
// null checks. This is TypeScript doing its actual job — turning "hope the JSON
// is right" into compile-time-checked validation.
//
// Build:  npx tsc tools/scenecheck.ts --outDir tools/dist --target ES2020 --module commonjs --strict
// Run:    node tools/dist/scenecheck.js path/to/scene.json
import { readFileSync } from "node:fs";

type Vec3 = [number, number, number];

interface LambertMat { type: "lambert"; albedo: Vec3; }
interface MetalMat { type: "metal"; albedo: Vec3; fuzz?: number; }
interface DielectricMat { type: "dielectric"; ior?: number; }
type Material = LambertMat | MetalMat | DielectricMat;

interface Sphere { center: Vec3; radius: number; material: Material; }
interface Camera { lookfrom?: Vec3; lookat?: Vec3; vfov?: number; }
interface Scene { camera?: Camera; spheres: Sphere[]; }

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

type Result = { ok: true; scene: Scene } | { ok: false; errors: string[] };

function validateScene(obj: unknown): Result {
  if (typeof obj !== "object" || obj === null) return { ok: false, errors: ["scene must be an object"] };
  const o = obj as Record<string, unknown>;
  const errors: string[] = [];

  if (!Array.isArray(o.spheres)) {
    errors.push("`spheres` must be an array");
  } else {
    o.spheres.forEach((s: unknown, i: number) => {
      const sp = s as Record<string, unknown>;
      if (!isVec3(sp.center)) errors.push(`sphere ${i}: center must be [x, y, z]`);
      if (typeof sp.radius !== "number" || sp.radius <= 0) errors.push(`sphere ${i}: radius must be a number > 0`);
      const m = sp.material as Record<string, unknown> | undefined;
      if (!m || typeof m.type !== "string") {
        errors.push(`sphere ${i}: material.type is required`);
      } else if (!["lambert", "metal", "dielectric"].includes(m.type)) {
        errors.push(`sphere ${i}: unknown material "${m.type}"`);
      } else if ((m.type === "lambert" || m.type === "metal") && !isVec3(m.albedo)) {
        errors.push(`sphere ${i}: ${m.type} material needs albedo [r, g, b]`);
      }
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, scene: obj as unknown as Scene };
}

function main(): void {
  const path = process.argv[2];
  if (!path) { console.error("usage: node scenecheck.js <scene.json>"); process.exit(1); }

  let data: unknown;
  try { data = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { console.error("cannot read/parse:", (e as Error).message); process.exit(1); }

  const res = validateScene(data);
  if (res.ok) {
    console.log(`✅ valid scene — ${res.scene.spheres.length} sphere(s)`);
  } else {
    console.log("❌ invalid scene:");
    res.errors.forEach((e) => console.log("  •", e));
    process.exit(2);
  }
}

main();

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AnalyzeRequest = {
  imageBase64?: string;
};

type AnalyzeItem = {
  name: string;
  slot: string;
  imagePath: string;
};

type AnalyzeResult = {
  items: AnalyzeItem[];
  error: string;
};

const SYSTEM_PROMPT =
  "Tu es un expert de Throne and Liberty. Analyse cette capture d'écran de liste d'objets. " +
  "Extrais tous les items visibles et retourne un JSON strict : " +
  "items (Array) : Liste d'objets { name, slot, imagePath }. " +
  "name (String) : Le nom exact de l'objet (relis le texte 2 fois pour éviter les fautes). " +
  "slot (String) : Peut rester vide si incertain. " +
  "imagePath (String) : Laisse vide si inconnu. " +
  "error (String) : Vide si OK, sinon 'image_illisible'. " +
  "Si aucun item n'est lisible, mets items=[] et error='image_illisible'.";

const RESPONSE_SCHEMA = {
  name: "loot_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            slot: { type: "string" },
            imagePath: { type: "string" },
          },
          required: ["name", "slot", "imagePath"],
        },
      },
      error: { type: "string" },
    },
    required: ["items", "error"],
  },
} as const;

const ITEMS_ROOT = path.join(process.cwd(), "public", "items");

let cachedIndex: Array<{ slug: string; path: string; baseName: string }> | null =
  null;

const normalizeSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/['"]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .trim();

const singularize = (value: string) =>
  value
    .split("_")
    .map((part) => (part.length > 3 && part.endsWith("s") ? part.slice(0, -1) : part))
    .join("_");

const slugVariants = (value: string) => {
  const base = normalizeSlug(value);
  const singular = singularize(base);
  return Array.from(new Set([base, singular].filter(Boolean)));
};

const levenshtein = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
};

const buildImageIndex = () => {
  if (cachedIndex) {
    return cachedIndex;
  }
  const entries: Array<{ slug: string; path: string; baseName: string }> = [];
  const walk = (dir: string) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach((item) => {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (!item.isFile() || !item.name.toLowerCase().endsWith(".png")) {
        return;
      }
      const relative = path
        .relative(ITEMS_ROOT, fullPath)
        .split(path.sep)
        .join("/");
      const baseName = item.name.replace(/\.png$/i, "");
      const slug = normalizeSlug(baseName);
      entries.push({ slug, path: `/items/${relative}`, baseName });
    });
  };
  if (fs.existsSync(ITEMS_ROOT)) {
    walk(ITEMS_ROOT);
  }
  cachedIndex = entries;
  return entries;
};

const resolveImagePath = (itemName: string) => {
  if (!itemName) {
    return { imagePath: "", resolvedName: "" };
  }
  const variants = slugVariants(itemName);
  const index = buildImageIndex();
  const brocanteIndex = index.filter((entry) =>
    entry.path.toLowerCase().includes("/brocante/"),
  );
  const directBrocante = brocanteIndex.find((entry) =>
    variants.some((variant) => entry.slug === variant),
  );
  if (directBrocante) {
    return {
      imagePath: directBrocante.path,
      resolvedName: directBrocante.baseName.replace(/_/g, " ").trim(),
    };
  }
  const direct = index.find((entry) =>
    variants.some((variant) => entry.slug === variant),
  );
  if (direct) {
    return {
      imagePath: direct.path,
      resolvedName: direct.baseName.replace(/_/g, " ").trim(),
    };
  }
  const containsBrocante = brocanteIndex.find((entry) =>
    variants.some(
      (variant) => entry.slug.includes(variant) || variant.includes(entry.slug),
    ),
  );
  if (containsBrocante) {
    return {
      imagePath: containsBrocante.path,
      resolvedName: containsBrocante.baseName.replace(/_/g, " ").trim(),
    };
  }
  const contains = index.find((entry) =>
    variants.some(
      (variant) => entry.slug.includes(variant) || variant.includes(entry.slug),
    ),
  );
  if (contains) {
    return {
      imagePath: contains.path,
      resolvedName: contains.baseName.replace(/_/g, " ").trim(),
    };
  }
  const bestMatch = (entries: typeof index) => {
    let best: (typeof entries)[number] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    variants.forEach((variant) => {
      entries.forEach((entry) => {
        const distance = levenshtein(variant, entry.slug);
        const maxLen = Math.max(variant.length, entry.slug.length, 1);
        const ratio = distance / maxLen;
        if (ratio < bestScore) {
          bestScore = ratio;
          best = entry;
        }
      });
    });
    return { best, bestScore };
  };

  const brocanteBest = bestMatch(brocanteIndex);
  if (brocanteBest.best && brocanteBest.bestScore <= 0.25) {
    return {
      imagePath: brocanteBest.best.path,
      resolvedName: brocanteBest.best.baseName.replace(/_/g, " ").trim(),
    };
  }
  const globalBest = bestMatch(index);
  if (globalBest.best && globalBest.bestScore <= 0.25) {
    return {
      imagePath: globalBest.best.path,
      resolvedName: globalBest.best.baseName.replace(/_/g, " ").trim(),
    };
  }
  return { imagePath: "", resolvedName: "" };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const rawImage = body.imageBase64?.trim();

    if (!rawImage) {
      return NextResponse.json(
        { ok: false, error: "Image manquante." },
        { status: 400 },
      );
    }

    const imageUrl = rawImage.startsWith("data:")
      ? rawImage
      : `data:image/png;base64,${rawImage}`;

    let parsed: AnalyzeResult | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse cette image." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content ?? "";
      try {
        parsed = JSON.parse(content) as AnalyzeResult;
      } catch {
        lastError = "Réponse illisible de l'IA.";
        continue;
      }

      if (parsed) {
        break;
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: lastError ?? "Réponse illisible de l'IA." },
        { status: 502 },
      );
    }

    if (parsed.error) {
      return NextResponse.json(
        { ok: false, error: "Image illisible." },
        { status: 422 },
      );
    }

    if (!parsed.items || parsed.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Réponse incomplète de l'IA." },
        { status: 502 },
      );
    }

    const enrichedItems = parsed.items.map((item) => {
      const resolved = resolveImagePath(item.name);
      return {
        ...item,
        name: resolved.resolvedName || item.name,
        imagePath: resolved.imagePath,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        items: enrichedItems,
        error: "",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

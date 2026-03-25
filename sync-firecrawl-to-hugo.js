#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const FIRECRAWL_DIR = path.join(ROOT, "source", "firecrawl");
const SITE_DIR = path.join(ROOT, "site");
const CONTENT_DIR = path.join(SITE_DIR, "content");
const DATA_DIR = path.join(SITE_DIR, "data");

const SITE_HOST = "https://www.dccx-digital.com";
const FOOTER_LOGO = "![](https://www.dccx-digital.com/wp-content/uploads/2023/10/02_dccx-white.svg)";
const CONTACT_LINK = "- [Kontakt](https://www.dccx-digital.com/kontakt/)";

const NAVIGATION = {
  main: [
    {
      name: "Leistungen",
      url: "our-services/",
      children: [
        { name: "App-Entwicklung", url: "app-entwicklung/" },
        { name: "BGF/BGM – Pandocs", url: "bgf/" },
        { name: "Social Media", url: "social-media-marketing/" },
        { name: "Websites", url: "websites/" },
        {
          name: "KI-Beratung",
          url: "ki-beratung/",
          children: [
            { name: "Allgemein", url: "ki-beratung/" },
            { name: "KI-Agent", url: "ki-agent/" },
            { name: "Assistenz & Wissenssysteme", url: "ki-assistenz-wissenssysteme/" },
            { name: "Workshops", url: "ki-workshops/" },
          ],
        },
      ],
    },
    { name: "KI-Agent", url: "ki-agent/" },
    {
      name: "Über uns",
      url: "team/",
      children: [
        { name: "Team", url: "team/" },
        { name: "Unsere Marken", url: "unsere-marken/" },
        { name: "Offene Stellen", url: "offene-stellen/" },
        { name: "Merchandise", url: "merch-2/" },
        { name: "Blog", url: "blog/" },
      ],
    },
    { name: "Kontakt", url: "kontakt/" },
  ],
  footer_services: [
    { name: "App-Entwicklung", url: "app-entwicklung/" },
    { name: "KI-Agent", url: "ki-agent/" },
    { name: "Betriebliche Gesundheitsförderung", url: "bgf/" },
    { name: "Social Media Marketing", url: "social-media-marketing/" },
    { name: "Websites", url: "websites/" },
  ],
  footer_contact: [
    { name: "Kontakt", url: "kontakt/" },
    { name: "Team", url: "team/" },
    { name: "Datenschutz", url: "datenschutz/" },
    { name: "Impressum", url: "impressum/" },
  ],
};

const HOMEPAGE_MAIN_META = [
  { url: "social-media-marketing/", icon: "trending-up" },
  { url: "app-entwicklung/", icon: "code" },
  { url: "bgf/", icon: "heart" },
  { url: "websites/", icon: "globe" },
  { url: "ki-beratung/", icon: "cpu" },
  { url: "app-entwicklung/", icon: "smartphone" },
];

const SERVICES_PAGE_IMAGES = {
  "App Entwicklung": "/images/illustrations/app-entwicklung.png",
  "Foto und Video": "/images/illustrations/foto-video.png",
  "Social Media Marketing": "/images/illustrations/social-media.png",
  "KI Beratung": "/images/illustrations/ki-beratung.png",
  "Onlineshops": "/images/illustrations/onlineshops.png",
  "Betriebliche Gesundheits­förderung": "/images/illustrations/bgf.png",
  Websites: "/images/illustrations/websites.png",
};

const HOMEPAGE_CLIENT_ALIASES = {
  "pandocs schriftzug 1": "pandocs",
  "pandocs 1": "pandocs",
  "hervis logo": "hervis",
  "wirtschaftskammer osterreich logo": "wirtschaftskammer osterreich",
  "bildungszentrum logistik gmbh co kg": "bildungszentrum logistik",
};

async function main() {
  const firecrawlPages = await loadFirecrawlPages();

  const summaries = [];
  for (const page of firecrawlPages) {
    const filePath = hugoContentPath(page.routePath);
    const existing = await readExistingContent(filePath);
    const content = buildHugoContent(page, existing);
    await writeFileIfChanged(filePath, content);
    summaries.push({ route: page.routePath, file: relativeFromRoot(filePath) });
  }

  await removeIfExists(path.join(CONTENT_DIR, "merchandise", "_index.md"));
  await removeIfEmpty(path.join(CONTENT_DIR, "merchandise"));

  const teamPage = getPage(firecrawlPages, "/team/");
  const homePage = getPage(firecrawlPages, "/");
  const servicesPage = getPage(firecrawlPages, "/our-services/");

  await writeFileIfChanged(path.join(DATA_DIR, "navigation.yaml"), toYaml(NAVIGATION));
  await writeFileIfChanged(path.join(DATA_DIR, "team.yaml"), buildTeamYaml(teamPage.cleanedBody));
  await writeFileIfChanged(path.join(DATA_DIR, "services.yaml"), buildServicesYaml(homePage.cleanedBody, servicesPage.cleanedBody));
  await writeFileIfChanged(path.join(DATA_DIR, "clients.yaml"), buildClientsYaml(homePage.cleanedBody));

  console.log(`Synced ${summaries.length} firecrawl pages into Hugo content.`);
  console.log(`Updated data files: navigation.yaml, team.yaml, services.yaml, clients.yaml`);
}

function getPage(pages, routePath) {
  const page = pages.find((entry) => entry.routePath === routePath);
  if (!page) {
    throw new Error(`Missing firecrawl page for ${routePath}`);
  }
  return page;
}

async function loadFirecrawlPages() {
  const files = (await fs.readdir(FIRECRAWL_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort();

  const pages = [];
  for (const name of files) {
    const filePath = path.join(FIRECRAWL_DIR, name);
    const text = await fs.readFile(filePath, "utf8");
    const parsed = parseFirecrawlFile(text);
    const title = cleanTitle(parsed.meta.title || "");
    const routePath = normalizeRoutePath(parsed.meta.url);
    const stripped = stripWrapper(parsed.body);
    const contentBody = routePath === "/" ? stripped : stripLeadingH1(stripped);
    const cleanedBody = convertInternalLinks(contentBody).trim();

    pages.push({
      filePath,
      routePath,
      title,
      meta: parsed.meta,
      cleanedBody,
    });
  }

  return pages.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function parseFirecrawlFile(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid firecrawl markdown: missing frontmatter");
  }

  const meta = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const lineMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*"?(.*?)"?$/);
    if (lineMatch) {
      meta[lineMatch[1]] = lineMatch[2];
    }
  }

  return { meta, body: match[2] };
}

function normalizeRoutePath(urlValue) {
  const url = new URL(urlValue);
  let routePath = url.pathname || "/";
  if (!routePath.endsWith("/")) {
    routePath += "/";
  }
  return routePath;
}

function cleanTitle(title) {
  return title.replace(/\s*-\s*dccx GmbH\s*$/i, "").trim();
}

function stripWrapper(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const footerIndex = lines.findIndex(
    (line, index) => index > 20 && line.trim() === FOOTER_LOGO,
  );
  const contentLines = footerIndex >= 0 ? lines.slice(0, footerIndex) : lines;

  let startIndex = -1;
  for (let index = 0; index < contentLines.length; index += 1) {
    if (contentLines[index].trim() === CONTACT_LINK) {
      startIndex = index;
    }
  }

  startIndex = startIndex >= 0 ? startIndex + 1 : 0;
  while (startIndex < contentLines.length && contentLines[startIndex].trim() === "") {
    startIndex += 1;
  }

  let endIndex = contentLines.length;
  while (endIndex > startIndex && contentLines[endIndex - 1].trim() === "") {
    endIndex -= 1;
  }

  return contentLines.slice(startIndex, endIndex).join("\n");
}

function stripLeadingH1(body) {
  const lines = body.split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }

  if (index < lines.length && /^#\s+/.test(lines[index].trim())) {
    index += 1;
    while (index < lines.length && lines[index].trim() === "") {
      index += 1;
    }
    return lines.slice(index).join("\n");
  }

  return body;
}

function convertInternalLinks(body) {
  return body.replace(/\((https:\/\/www\.dccx-digital\.com\/[^)\s]+)\)/g, (fullMatch, urlValue) => {
    const url = new URL(urlValue);
    if (url.pathname.startsWith("/wp-content/") || url.pathname.startsWith("/wp-includes/")) {
      return fullMatch;
    }
    return `(${url.pathname}${url.search}${url.hash})`;
  });
}

function hugoContentPath(routePath) {
  if (routePath === "/") {
    return path.join(CONTENT_DIR, "_index.md");
  }

  const cleanPath = routePath.replace(/^\/+|\/+$/g, "");
  return path.join(CONTENT_DIR, ...cleanPath.split("/"), "_index.md");
}

async function readExistingContent(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return parseContentFrontMatter(text);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { data: {}, order: [], body: "" };
    }
    throw error;
  }
}

function parseContentFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, order: [], body: text };
  }

  const order = [];
  const data = {};
  let currentArrayKey = null;

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue;
    }

    const arrayMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (arrayMatch) {
      currentArrayKey = arrayMatch[1];
      order.push(currentArrayKey);
      data[currentArrayKey] = [];
      continue;
    }

    const itemMatch = rawLine.match(/^\s*-\s*(.+)\s*$/);
    if (itemMatch && currentArrayKey) {
      data[currentArrayKey].push(parseScalar(itemMatch[1]));
      continue;
    }

    const keyMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.+)\s*$/);
    if (keyMatch) {
      currentArrayKey = null;
      order.push(keyMatch[1]);
      data[keyMatch[1]] = parseScalar(keyMatch[2]);
    }
  }

  return { data, order, body: match[2] };
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "[]") return [];
  if (/^".*"$/.test(trimmed)) return trimmed.slice(1, -1).replace(/\\"/g, '"');
  return trimmed;
}

function buildHugoContent(page, existing) {
  const data = { ...existing.data };
  const order = [...existing.order];

  setFrontMatterValue(order, data, "title", page.title || page.meta.title || "");
  if (!data.description) {
    const description = deriveDescription(page.cleanedBody);
    if (description) {
      setFrontMatterValue(order, data, "description", description);
    }
  }

  if (page.routePath !== "/") {
    setFrontMatterValue(order, data, "layout", "single");
    if (!Object.prototype.hasOwnProperty.call(data, "show_hero")) {
      setFrontMatterValue(order, data, "show_hero", false);
    }
    setFrontMatterValue(order, data, "show_values_row", false);
    setFrontMatterValue(order, data, "show_marquee", false);
    setFrontMatterValue(order, data, "show_mehr_infos", false);
    setFrontMatterValue(order, data, "show_cta_bar", false);
    setFrontMatterValue(order, data, "show_tech_stack", false);
  }

  const preferredOrder = [
    "title",
    "description",
    "layout",
    "show_hero",
    "hero_image",
    "hero_subtitle",
    "show_values_row",
    "show_marquee",
    "marquee_text",
    "show_mehr_infos",
    "mehr_infos_text",
    "show_cta_bar",
    "cta_text",
    "cta_button_text",
    "show_tech_stack",
    "aliases",
  ];

  const frontMatter = serializeFrontMatter(data, order, preferredOrder);
  return `---\n${frontMatter}---\n\n${page.cleanedBody.trim()}\n`;
}

function setFrontMatterValue(order, data, key, value) {
  if (!order.includes(key)) {
    order.push(key);
  }
  data[key] = value;
}

function deriveDescription(body) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (
      /^#{1,6}\s+/.test(paragraph) ||
      paragraph.startsWith("![") ||
      paragraph.startsWith("- ") ||
      paragraph.startsWith("[") ||
      paragraph === "//"
    ) {
      continue;
    }

    return stripMarkdown(paragraph).slice(0, 220);
  }

  return "";
}

function stripMarkdown(value) {
  return value
    .replace(/!\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeFrontMatter(data, existingOrder, preferredOrder) {
  const orderedKeys = [];

  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(data, key) && !orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  for (const key of existingOrder) {
    if (Object.prototype.hasOwnProperty.call(data, key) && !orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  for (const key of Object.keys(data)) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  const lines = [];
  for (const key of orderedKeys) {
    const value = data[key];
    if (Array.isArray(value)) {
      if (!value.length) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${formatScalar(item)}`);
        }
      }
      continue;
    }
    lines.push(`${key}: ${formatScalar(value)}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatScalar(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseCurrentClientsYaml(text) {
  const clients = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const nameMatch = rawLine.match(/^- name:\s*"(.*)"\s*$/);
    if (nameMatch) {
      if (current) clients.push(current);
      current = { name: nameMatch[1], logo: "" };
      continue;
    }

    const logoMatch = rawLine.match(/^\s+logo:\s*"(.*)"\s*$/);
    if (logoMatch && current) {
      current.logo = logoMatch[1];
    }
  }

  if (current) clients.push(current);
  return clients;
}

function normalizeClientName(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_()&.,+-]/g, " ")
    .replace(/\bgmbh\b|\bco\b|\bkg\b|\blogo\b|\bschriftzug\b|\brot\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseClientEntries(homeBody) {
  const lines = homeBody.split("\n");
  const start = lines.findIndex((line) =>
    /^\[www\.siethomgroup\.com\]\(http:\/\/www\.siethomgroup\.com\/?\)$/.test(line.trim()),
  );
  const end = lines.findIndex((line, index) => index > start && line.trim() === "## Bereit für den nächsten Schritt?");
  if (start < 0 || end < 0) {
    throw new Error("Unable to locate home page client logo block");
  }

  const entries = [];
  const seen = new Set();
  for (const rawLine of lines.slice(start + 1, end)) {
    const match = rawLine.trim().match(/^!\[(.*?)\]\((.+)\)$/);
    if (!match) continue;
    if (seen.has(match[1])) break;
    seen.add(match[1]);
    entries.push({ name: match[1], remote: match[2] });
  }

  return entries;
}

function parseSectionCards(lines, stopPredicate) {
  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (stopPredicate(line)) {
      if (current) items.push(current);
      break;
    }

    if (line.startsWith("##### ")) {
      if (current) items.push(current);
      current = { title: line.slice(6).trim(), description: "", url: "" };
      continue;
    }

    if (!current) continue;

    const linkMatch = line.match(/^\[read more\]\((.+)\)$/i);
    if (linkMatch) {
      current.url = linkMatch[1];
      continue;
    }

    if (line && !line.startsWith("![") && !line.startsWith("## ") && !line.startsWith("### ")) {
      current.description = current.description ? `${current.description} ${line}` : line;
    }
  }

  return items;
}

function parseTeamEntries(teamBody) {
  const lines = teamBody.split("\n");
  const entries = { management: [], members: [] };

  let section = "members";
  let pendingImage = "";
  let current = null;

  function flush() {
    if (!current) return;
    entries[section].push(current);
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "## Geschäftsführung") {
      flush();
      section = "management";
      pendingImage = "";
      continue;
    }
    if (line === "## Digitalagentur Linz") {
      flush();
      break;
    }

    const imageMatch = line.match(/^!\[\]\((.+)\)$/);
    if (imageMatch) {
      pendingImage = imageMatch[1];
      continue;
    }

    const headingMatch = line.match(/^####\s+(.+)$/);
    if (headingMatch) {
      flush();
      current = { name: headingMatch[1], role: "", image: pendingImage, email: "", linkedin: "" };
      pendingImage = "";
      continue;
    }

    if (!current) continue;

    const linkMatch = line.match(/^\[(.+?)\]\((.+)\)$/);
    if (linkMatch) {
      const url = linkMatch[2];
      if (url.startsWith("mailto:")) {
        current.email = url.replace(/^mailto:/, "");
      } else if (url.includes("linkedin.com")) {
        current.linkedin = url;
      }
      continue;
    }

    if (!current.role && line) {
      current.role = line;
    }
  }

  flush();
  return entries;
}

function buildTeamYaml(teamBody) {
  const team = parseTeamEntries(teamBody);
  return toYaml(team);
}

function buildServicesYaml(homeBody, servicesBody) {
  const homeLines = homeBody.split("\n");
  const servicesLines = servicesBody.split("\n");

  const homepageMain = parseSectionCards(homeLines, (line) => line === "#### Unsere Referenzen").map((entry, index) => ({
    title: entry.title,
    description: entry.description,
    url: HOMEPAGE_MAIN_META[index].url,
    icon: HOMEPAGE_MAIN_META[index].icon,
  }));

  const bottomStart = homeLines.findIndex((line) => line.trim() === "## alles aus einer hand...");
  const homepageBottom = parseSectionCards(
    homeLines.slice(bottomStart + 1),
    (line) => line.startsWith("![](") || line.startsWith("## Unser Tech Stack"),
  ).map((entry) => ({
    title: entry.title,
    description: entry.description,
    url: trimLeadingSlash(entry.url),
  }));

  const servicesPage = parseSectionCards(
    servicesLines,
    (line) => line.startsWith("### Wie können wir euch helfen?"),
  ).map((entry) => ({
    title: entry.title,
    description: entry.description,
    url: trimLeadingSlash(entry.url),
    image: SERVICES_PAGE_IMAGES[entry.title] || "",
  }));

  return toYaml({
    homepage_main: homepageMain,
    homepage_bottom: homepageBottom,
    services_page: servicesPage,
  });
}

function buildClientsYaml(homeBody) {
  const currentText = require("node:fs").readFileSync(path.join(DATA_DIR, "clients.yaml"), "utf8");
  const currentClients = parseCurrentClientsYaml(currentText);
  const currentMap = new Map(
    currentClients.map((entry) => [normalizeClientName(entry.name), entry]),
  );

  const orderedClients = parseClientEntries(homeBody).map((entry) => {
    const normalized = normalizeClientName(entry.name);
    const mapped = currentMap.get(normalized) || currentMap.get(HOMEPAGE_CLIENT_ALIASES[normalized] || "");
    return {
      name: mapped ? mapped.name : entry.name,
      logo: mapped ? mapped.logo : entry.remote,
    };
  });

  return toYaml(orderedClients);
}

function trimLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}

function toYaml(value, indent = 0) {
  const padding = " ".repeat(indent);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (!entries.length) return `${padding}- {}`;
          const [firstKey, firstValue] = entries[0];
          const firstLine = `${padding}- ${firstKey}: ${yamlScalar(firstValue)}`;
          const remaining = entries
            .slice(1)
            .map(([key, nestedValue]) => {
              if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
                return `${padding}  ${key}:\n${toYaml(nestedValue, indent + 4)}`;
              }
              if (Array.isArray(nestedValue)) {
                if (!nestedValue.length) return `${padding}  ${key}: []`;
                return `${padding}  ${key}:\n${toYaml(nestedValue, indent + 4)}`;
              }
              return `${padding}  ${key}: ${yamlScalar(nestedValue)}`;
            })
            .join("\n");
          return remaining ? `${firstLine}\n${remaining}` : firstLine;
        }

        return `${padding}- ${yamlScalar(item)}`;
      })
      .join("\n")
      .concat("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        if (Array.isArray(nestedValue)) {
          if (!nestedValue.length) return `${padding}${key}: []`;
          return `${padding}${key}:\n${toYaml(nestedValue, indent + 2).trimEnd()}`;
        }
        if (nestedValue && typeof nestedValue === "object") {
          return `${padding}${key}:\n${toYaml(nestedValue, indent + 2).trimEnd()}`;
        }
        return `${padding}${key}: ${yamlScalar(nestedValue)}`;
      })
      .join("\n")
      .concat("\n");
  }

  return `${padding}${yamlScalar(value)}\n`;
}

function yamlScalar(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function writeFileIfChanged(filePath, nextContent) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let currentContent = null;
  try {
    currentContent = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }

  if (currentContent !== nextContent) {
    await fs.writeFile(filePath, nextContent, "utf8");
  }
}

async function removeIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

async function removeIfEmpty(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    if (!entries.length) {
      await fs.rmdir(dirPath);
    }
  } catch (error) {
    if (!error || (error.code !== "ENOENT" && error.code !== "ENOTEMPTY")) throw error;
  }
}

function relativeFromRoot(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(frontend, 'public/brand/careermate/v1');
const iconModule = path.join(frontend, 'node_modules/@mui/icons-material');
const icons = {
  home: 'HomeOutlined', profile: 'PersonOutlineOutlined', team: 'GroupsOutlined',
  assessment: 'AssignmentOutlined', chat: 'ChatBubbleOutlineOutlined', career: 'WorkOutlineOutlined',
  learning: 'SchoolOutlined', roadmap: 'AccountTreeOutlined', calendar: 'CalendarTodayOutlined',
  clock: 'AccessTimeOutlined', document: 'DescriptionOutlined', folder: 'FolderOutlined',
  certificate: 'WorkspacePremiumOutlined', trophy: 'EmojiEventsOutlined', goal: 'OutlinedFlag',
  customize: 'TuneOutlined', edit: 'EditOutlined', add: 'AddRounded', close: 'CloseRounded',
  'arrow-right': 'ArrowForwardRounded', 'arrow-left': 'ArrowBackRounded',
  'chevron-up': 'KeyboardArrowUpRounded', 'chevron-down': 'KeyboardArrowDownRounded',
  drag: 'DragIndicatorRounded', check: 'CheckRounded', lock: 'LockOutlined',
  search: 'SearchRounded', info: 'InfoOutlined', 'check-circle': 'CheckCircleOutlineOutlined',
  pdf: 'PictureAsPdfOutlined', upload: 'UploadFileOutlined', save: 'SaveOutlined',
  undo: 'UndoRounded', help: 'HelpOutlineOutlined', settings: 'SettingsOutlined',
  bell: 'NotificationsNoneOutlined', personal: 'FavoriteBorderOutlined', fit: 'FullscreenRounded',
  'zoom-in': 'ZoomInRounded', 'zoom-out': 'ZoomOutRounded', list: 'FormatListBulletedRounded',
  download: 'DownloadRounded', view: 'VisibilityOutlined',
};

const palette = {
  canvas: '#F7F8F5', surface: '#FFFFFF', primary: '#3E7868', primaryText: '#336655',
  primarySubtle: '#E4EFE7', selectedBorder: '#91B3A1', sand: '#F3E9D7',
  heading: '#243F36', body: '#303B36', secondary: '#626C65', border: '#E2E8E4',
  muted: '#EFF2EF', danger: '#AD442E',
};
const entries = [];
const shapes = {};
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;

async function asset(id, category, width, height, body, extra = {}) {
  const relative = `${category}/${id}.svg`;
  await mkdir(path.join(root, category), { recursive: true });
  await writeFile(path.join(root, relative), svg(width, height, body));
  entries.push({ id, category, src: `/brand/careermate/v1/${relative}`, width, height, format: 'svg', ...extra });
}

for (const [name, moduleName] of Object.entries(icons)) {
  const source = await readFile(path.join(iconModule, `${moduleName}.js`), 'utf8');
  const paths = [...source.matchAll(/\bd: "([^"]+)"/g)].map((match) => match[1]);
  if (paths.length === 0 || /\b(cx|cy|points):/.test(source)) {
    throw new Error(`Review the geometry of ${moduleName} before exporting it.`);
  }
  shapes[name] = paths.map((d) => `<path d="${d}"/>`).join('');
  await asset(name, 'icons', 24, 24, `<g fill="currentColor">${shapes[name]}</g>`, { origin: `@mui/icons-material/${moduleName}` });
}
const sprite = Object.keys(icons).map((name) => `<symbol id="${name}" viewBox="0 0 24 24"><g fill="currentColor">${shapes[name]}</g></symbol>`).join('');
await writeFile(path.join(root, 'icons/sprite.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${sprite}</svg>\n`);
await copyFile(path.join(iconModule, 'LICENSE'), path.join(root, 'LICENSE-icons.txt'));

const glyph = (name, x, y, size, color) => `<g fill="${color}" transform="translate(${x} ${y}) scale(${size / 24})">${shapes[name]}</g>`;
const steps = [
  ['step-completed', '#DBEADD', '#BED5C4', '#92B39B', '#477653', 'check'],
  ['step-current', '#729E8A', '#3E7868', '#2E5F50', '#FFFFFF', 'arrow-right'],
  ['step-upcoming', '#F5F1E8', '#E6E1D6', '#C9C3B6', '#797C70', 'lock'],
  ['step-goal', '#F8E8C3', '#DCC596', '#B59B68', '#6F592E', 'goal'],
];
for (const [id, light, mid, depth, ink, icon] of steps) {
  await asset(id, 'roadmap', 256, 160, `<defs><linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs><path d="M24 61V83C24 108 70 128 128 128S232 108 232 83V61Z" fill="${depth}"/><ellipse cx="128" cy="61" rx="104" ry="43" fill="url(#${id}-top)"/><path d="M42 50C57 31 91 23 128 23S199 31 214 50" fill="none" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/><g fill="${ink}" transform="translate(98 38) scale(2.5 1.85)">${shapes[icon]}</g>`);
}

for (const [id, icon, light, mid, ink] of [
  ['badge-learning', 'learning', '#DBEADD', '#94B6A2', '#315E4F'],
  ['badge-feedback', 'chat', '#E3ECE8', '#A7C1B8', '#315E4F'],
  ['badge-team', 'team', '#F6EEDB', '#D6C293', '#756036'],
  ['badge-achievement', 'trophy', '#F4E2B9', '#D3B77B', '#70542C'],
]) {
  await asset(id, 'badges', 160, 176, `<defs><linearGradient id="${id}-metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs><path d="M44 102L33 161L58 151L77 168L85 113Z" fill="${mid}"/><path d="M78 113L88 168L108 151L132 159L119 101Z" fill="${ink}" opacity=".72"/><circle cx="80" cy="76" r="62" fill="${mid}"/><circle cx="80" cy="71" r="61" fill="url(#${id}-metal)"/><circle cx="80" cy="71" r="47" fill="#FFFFFF" fill-opacity=".26"/>${glyph(icon, 48, 39, 64, ink)}`);
}

await asset('spot-learning', 'illustrations', 320, 240, `<defs><linearGradient id="book-cover" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#79A38D"/><stop offset="1" stop-color="#3E7868"/></linearGradient></defs><path d="M55 89L145 107L242 77V166L148 197L55 177Z" fill="#CFDBD0"/><path d="M54 77L146 95L250 65V155L147 186L54 166Z" fill="url(#book-cover)"/><path d="M67 69C93 65 121 73 147 84C173 66 206 56 237 57V145C205 145 176 155 147 173C123 161 96 154 67 154Z" fill="#FEFDF7"/><path d="M147 84V173" stroke="#E1E2D6" stroke-width="3"/><path d="M82 94L130 107M82 109L130 122M82 124L116 134M166 99L220 81M166 114L220 96M166 129L209 114" stroke="#BECABD" stroke-width="5" stroke-linecap="round"/><path d="M199 55V113L210 100L222 106V54Z" fill="#D4B878"/><path d="M264 41L268 53L280 57L268 61L264 73L260 61L248 57L260 53Z" fill="#D7BE88"/><circle cx="42" cy="146" r="6" fill="#A7C2AD"/>`);
await asset('spot-mindmap', 'illustrations', 320, 240, `<path d="M158 119H106V62H70M158 119H218V57H251M158 119H220V181H254M106 119V187H67" fill="none" stroke="#A8BBAE" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="112" y="83" width="100" height="74" rx="21" fill="#2E5F50"/><rect x="112" y="77" width="100" height="74" rx="21" fill="#5A8D77"/>${glyph('goal', 142, 94, 40, '#FFFFFF')}<rect x="31" y="35" width="67" height="52" rx="16" fill="#E4EFE7"/>${glyph('document', 50, 46, 28, '#477653')}<rect x="225" y="27" width="67" height="52" rx="16" fill="#F3E9D7"/>${glyph('learning', 244, 38, 28, '#887343')}<rect x="225" y="153" width="67" height="52" rx="16" fill="#E4EFE7"/>${glyph('team', 244, 164, 28, '#477653')}<rect x="29" y="162" width="67" height="52" rx="16" fill="#F3E9D7"/>${glyph('chat', 48, 173, 28, '#887343')}`);
await asset('spot-documents', 'illustrations', 320, 240, `<path d="M47 67Q47 53 61 53H113L135 72H251Q265 72 265 86V189Q265 204 250 204H62Q47 204 47 189Z" fill="#68907A"/><g transform="rotate(-8 121 113)"><rect x="83" y="30" width="120" height="141" rx="12" fill="#D9E5DA"/></g><g transform="rotate(7 183 119)"><rect x="120" y="38" width="114" height="143" rx="12" fill="#FAF8F1"/><path d="M142 62H209M142 79H209M142 96H188" stroke="#BACBBC" stroke-width="6" stroke-linecap="round"/></g><path d="M54 114H263Q276 114 273 128L258 193Q256 204 242 204H72Q58 204 56 191L43 129Q40 114 54 114Z" fill="#ADC7AF"/><path d="M53 122H263" stroke="#C8DDCA" stroke-width="3" stroke-linecap="round"/>${glyph('upload', 134, 139, 48, '#3D6B55')}`);
await asset('mark', 'brand', 64, 64, `<path d="M10 42Q10 37 15 37H22V54H10Z" fill="#A9C4AF"/><path d="M26 28Q26 23 31 23H38V54H26Z" fill="#6E9C82"/><path d="M42 14Q42 9 47 9H54V54H42Z" fill="#3E7868"/>`);
await asset('mark-mono', 'brand', 64, 64, `<g fill="currentColor"><path d="M10 42Q10 37 15 37H22V54H10Z"/><path d="M26 28Q26 23 31 23H38V54H26Z"/><path d="M42 14Q42 9 47 9H54V54H42Z"/></g>`);

await writeFile(path.join(root, 'vectors.json'), JSON.stringify({ version: 1, palette, assets: entries }, null, 2) + '\n');
await writeFile(path.join(root, 'tokens.css'), `:root {\n${Object.entries(palette).map(([name, color]) => `  --cm-${name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())}: ${color};`).join('\n')}\n}\n`);
await writeFile(path.join(frontend, 'src/lib/careermateIcons.ts'), `// Generated by scripts/generate-careermate-assets.mjs.\nexport const careermateIconNames = ${JSON.stringify(Object.keys(icons), null, 2)} as const;\nexport type CareerMateIconName = (typeof careermateIconNames)[number];\n`);
console.log(`Created ${entries.length} SVG assets, ${Object.keys(icons).length} icon symbols and color tokens in ${root}`);

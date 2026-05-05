import { useState, useRef, useEffect, useMemo } from 'react';
import type { TemplateType } from '@/types';

const CONTEXT_GROUPS: Record<TemplateType, { label: string; emojis: string[] }> = {
  issue: {
    label: 'Issue types',
    emojis: ['🐛','✨','🚀','📋','✅','🔧','📈','⚡','🔒','🧪','♻️','🔥','🚧','💀','🎨','📦','📝','❓','🚫','🔄'],
  },
  wiki: {
    label: 'Wiki pages',
    emojis: ['📖','🗂️','📑','📌','🗒️','🛣️','⚙️','📊','🏛️','🗑️'],
  },
  project: {
    label: 'Project',
    emojis: ['🏗️','🗓️','🏁','🗺️','📬','📣','🏷️','👥','🔗'],
  },
};

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🥱','😴','😪','😮','🤤','😯','😦','😧','😮','😲','🥺','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱'],
  },
  {
    label: 'People',
    emojis: ['👍','👎','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄'],
  },
  {
    label: 'Nature',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🪲','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🪶','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃','🍂','🍁','🍄','🐚','🪸','🌾','💐','🌷','🌹','🥀','🪷','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌟','⭐','🌠','🌌','☁️','⛅','🌤','🌈','🌂','☂️','❄️','⛄','🌊','🌀'],
  },
  {
    label: 'Food',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🧉','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧊'],
  },
  {
    label: 'Travel',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🛶','🚤','🛳','⛴','🛥','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🛎','🧳','🌍','🗺','🧭','🏔','⛰','🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🗼','🗽','⛪','🕌','⛩','🕍','🛕','🗾','🎑','🏞','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙','🌃','🌌','🌉'],
  },
  {
    label: 'Activities',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🏋','🤼','🤸','🤺','🤾','🏌','🏇','🧘','🏄','🏊','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🎗','🎫','🎟','🎪','🤹','🎭','🎨','🖼','🎰','🚂','🏹','🎣','🤿','🥅','🎯','🪃','🎮','🕹','🎲','🎭','🎬','🎤','🎧','🎼','🎹','🪗','🥁','🪘','🎷','🎺','🎸','🎻','🪕','🎙'],
  },
  {
    label: 'Objects',
    emojis: ['💡','🔦','🕯','🪔','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒','🛠','⛏','🪛','🔩','⚙️','🗜','🪤','🧲','🪜','🪝','🧪','🧫','🧬','🔬','🔭','📡','💉','🩸','💊','🩹','🩺','🩻','🩼','🪤','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🪒','🪮','🛒','🚪','🪞','🪟','🛏','🛋','🪑','🚽','🪠','🚿','🛁','🧴','🧷','🧹','📦','📫','📬','📭','📮','📯','📜','📃','📋','📁','📂','🗂','📊','📈','📉','📆','📅','📇','📌','📍','✂️','🗃','🗄','🗑','🔒','🔓','🔑','🗝','🔨','🪓','🧲','💡','🔌','🖥','🖨','⌨️','🖱','💾','💿','📀','📱','☎️','📞','📟','📠','📺','📻','🎙','🎚','🎛','🧭','⏱','⏰','⏲','🕰','⌛','⏳','📡','🔋','🪫','🔌'],
  },
  {
    label: 'Symbols',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🪯','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','📶','🛜','📳','📴','✅','☑️','✔️','❎','🔀','🔁','🔂','▶️','⏩','⏭️','⏯️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬','⏸️','⏹️','⏺️','🎦','🔇','🔈','🔉','🔊','📢','📣','📯','🔔','🔕','🎵','🎶','💹','🛗','🏧','🚾','♿','🅿️','🛺','🈳','🈹','🚺','🚹','🚻','🚼','🚸','⚠️','🚦','🚥','🛑','⛔','🚫'],
  },
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  templateType?: TemplateType;
}

export function EmojiPicker({ value, onChange, templateType }: Props) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [group, setGroup]     = useState(0);
  const ref                   = useRef<HTMLDivElement>(null);

  const allGroups = useMemo(() => {
    if (!templateType) return GROUPS;
    return [CONTEXT_GROUPS[templateType], ...GROUPS];
  }, [templateType]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search.trim()
    ? allGroups.flatMap((g) => g.emojis).filter((e) => e.includes(search))
    : allGroups[group]?.emojis ?? [];

  return (
    <div className="ep-root" ref={ref}>
      <button
        type="button"
        className="ep-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Pick an icon"
      >
        {value ? <span className="ep-preview">{value}</span> : <span className="ep-placeholder">＋</span>}
      </button>

      {open && (
        <div className="ep-dropdown">
          <div className="ep-search-row">
            <svg className="ep-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              className="ep-search"
              placeholder="Search emoji…"
              value={search}
              autoFocus
              onChange={(e) => { setSearch(e.target.value); setGroup(0); }}
            />
            {value && (
              <button className="ep-clear" type="button" onClick={() => { onChange(''); setOpen(false); }}>✕</button>
            )}
          </div>

          {!search && (
            <div className="ep-tabs">
              {allGroups.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  className={`ep-tab${group === i ? ' ep-tab-active' : ''}`}
                  title={g.label}
                  onClick={() => setGroup(i)}
                >
                  {g.emojis[0]}
                </button>
              ))}
            </div>
          )}

          {search && filtered.length === 0 ? (
            <div className="ep-empty">No results</div>
          ) : (
            <div className="ep-grid">
              {filtered.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ep-cell${emoji === value ? ' ep-cell-active' : ''}`}
                  onClick={() => { onChange(emoji); setOpen(false); setSearch(''); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

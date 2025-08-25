import React, { useState } from 'react'

const LANGUAGES = [
  'Elvish',
  'Dwarvish',
  'Draconic',
  'Infernal',
  'Celestial',
  'Giant',
]

function mockTranslate(text, lang){
  // Very naive, distinctive transformations per language for mock purposes
  if (!text) return ''
  switch(lang){
    case 'Elvish':
      // vowel elongation
      return text.replace(/[aeiou]/gi, (v)=>v+v)
    case 'Dwarvish':
      // consonant doubling
      return text.replace(/([bcdfghjklmnpqrstvwxyz])/gi, (c)=>c+c)
    case 'Draconic':
      // reverse words and add apostrophes
      return text.split(' ').map(w=>w.split('').reverse().join('') + "'").join(' ')
    case 'Infernal':
      return text.split('').map((c,i)=> i%2? c.toUpperCase(): c.toLowerCase()).join('')
    case 'Celestial':
      return text.split(' ').map(w=>w + 'th').join(' ')
    case 'Giant':
      return text.toUpperCase()
    default:
      return text
  }
}

function mockPronunciation(text){
  // Simplified phonetic: replace vowels by common phonetic markers
  return text
    .replace(/th/gi, 'θ')
    .replace(/ch/gi, 'tʃ')
    .replace(/sh/gi, 'ʃ')
    .replace(/qu/gi, 'kw')
    .replace(/[aeiou]/gi, (v)=> v.toLowerCase())
}

export default function TranslatorModal({open, onClose}){
  const [selected, setSelected] = useState(LANGUAGES[0])
  const [text, setText] = useState('')

  if (!open) return null

  const translated = mockTranslate(text, selected)
  const pron = mockPronunciation(translated)

  function send(){
    if (!text.trim()) return
    // Dispatch a global event so ChatLog can append it.
    const payload = {
      id: Date.now(),
      author: 'You',
      type: 'msg',
      original: text,
      translated,
      lang: selected,
      pronunciation: pron,
    }
    window.dispatchEvent(new CustomEvent('npcchatter:message', {detail: payload}))
    setText('')
    onClose && onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded shadow-lg w-10/12 max-w-4xl p-4 grid grid-cols-3 gap-4">
        <div className="col-span-1 overflow-auto">
          <div className="font-semibold mb-2">Languages</div>
          <div className="space-y-1">
            {LANGUAGES.map(l => (
              <button key={l} onClick={()=>setSelected(l)} className={`w-full text-left btn btn-ghost ${selected===l? 'btn-active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="col-span-1">
          <div className="font-semibold mb-2">Input</div>
          <textarea className="textarea w-full h-48" value={text} onChange={e=>setText(e.target.value)} />
        </div>

        <div className="col-span-1">
          <div className="font-semibold mb-2">Translation ({selected})</div>
          <div className="bg-base-200 p-3 rounded h-36 overflow-auto">{translated || <span className="text-sm text-muted">Translation preview</span>}</div>
          <div className="mt-2 text-xs text-muted">Pronunciation</div>
          <div className="bg-base-200 p-2 rounded mt-1">{pron || <span className="text-sm text-muted">Pronunciation preview</span>}</div>
        </div>

        <div className="col-span-3 flex justify-end space-x-2 mt-3">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send}>Send Message</button>
        </div>
      </div>
    </div>
  )
}

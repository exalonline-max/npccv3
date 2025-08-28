let _counter = 0
export function nextId(){
  // Use timestamp with a small incrementing counter to keep ids unique and stable
  const now = Date.now()
  _counter = (_counter + 1) % 10000
  return `${now}-${_counter}`
}

export default { nextId }

import type { TestAction } from './types'

// Native beforeinput also receives software-keyboard insertions. Keydown is
// reserved for editing shortcuts; a printable key is never counted twice.
export function bindTypingInput(input: HTMLTextAreaElement, send: (action: TestAction) => void, now: () => number = () => performance.now()): () => void {
  let composing = false
  let compositionCommit: string | null = null
  let compositionTimer: ReturnType<typeof setTimeout> | undefined

  function commit(text: string) {
    if (text) send({ type: 'INSERT', text, nowMs: now() })
    input.value = ''
  }

  function isDuplicateComposition(event: InputEvent) {
    if (event.inputType === 'insertFromComposition' || (compositionCommit !== null && event.data === compositionCommit)) {
      compositionCommit = null
      return true
    }
    return false
  }

  function beforeInput(event: InputEvent) {
    if (composing || event.isComposing) return
    if (event.inputType.startsWith('delete')) {
      if (event.cancelable) {
        event.preventDefault()
        if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteWordBackward') {
          send({ type: event.inputType === 'deleteWordBackward' ? 'DELETE_WORD_BACKWARD' : 'DELETE_BACKWARD', nowMs: now() })
        }
      }
      return
    }
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop' || event.inputType.startsWith('history') || event.inputType === 'insertLineBreak') {
      event.preventDefault()
      input.value = ''
      return
    }
    if (!event.cancelable || event.data === null) return
    event.preventDefault()
    if (!isDuplicateComposition(event)) commit(event.data)
    else input.value = ''
  }

  function fallbackInput(event: Event) {
    const native = event as InputEvent
    if (composing || native.isComposing) return
    const text = input.value
    input.value = ''
    if (native.inputType === 'insertFromPaste' || native.inputType === 'insertFromDrop' || native.inputType?.startsWith('history')) return
    if (native.inputType === 'deleteContentBackward' || native.inputType === 'deleteWordBackward') {
      send({ type: native.inputType === 'deleteWordBackward' ? 'DELETE_WORD_BACKWARD' : 'DELETE_BACKWARD', nowMs: now() })
    } else if (text && !isDuplicateComposition(native)) commit(text)
  }

  function keyDown(event: KeyboardEvent) {
    if (event.isComposing || composing) return
    if (event.key === 'Backspace') {
      event.preventDefault()
      send({ type: event.ctrlKey || event.altKey || event.metaKey ? 'DELETE_WORD_BACKWARD' : 'DELETE_BACKWARD', nowMs: now() })
    } else if (event.key === 'Delete' || event.key === 'Enter') event.preventDefault()
  }

  function compositionStart() { composing = true }
  function compositionEnd(event: CompositionEvent) {
    composing = false
    compositionCommit = event.data || input.value
    commit(compositionCommit)
    clearTimeout(compositionTimer)
    compositionTimer = setTimeout(() => { compositionCommit = null }, 0)
  }
  function blockTransfer(event: Event) { event.preventDefault() }

  input.addEventListener('beforeinput', beforeInput)
  input.addEventListener('input', fallbackInput)
  input.addEventListener('keydown', keyDown)
  input.addEventListener('compositionstart', compositionStart)
  input.addEventListener('compositionend', compositionEnd)
  input.addEventListener('paste', blockTransfer)
  input.addEventListener('drop', blockTransfer)

  return () => {
    clearTimeout(compositionTimer)
    input.removeEventListener('beforeinput', beforeInput)
    input.removeEventListener('input', fallbackInput)
    input.removeEventListener('keydown', keyDown)
    input.removeEventListener('compositionstart', compositionStart)
    input.removeEventListener('compositionend', compositionEnd)
    input.removeEventListener('paste', blockTransfer)
    input.removeEventListener('drop', blockTransfer)
  }
}

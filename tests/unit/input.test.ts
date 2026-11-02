import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindTypingInput } from '../../src/features/typing/engine/input'

class InputStub extends EventTarget { value = '' }
const cleanups: Array<() => void> = []

function setup() {
  const input = new InputStub()
  const send = vi.fn()
  const cleanup = bindTypingInput(input as unknown as HTMLTextAreaElement, send, () => 100)
  cleanups.push(cleanup)
  return { input, send, cleanup }
}

function emit(input: InputStub, type: string, data: Record<string, unknown> = {}, cancelable = true) {
  const event = Object.assign(new Event(type, { cancelable }), data)
  input.dispatchEvent(event)
  return event
}

afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers() })

describe('native input adapter', () => {
  it('counts printable beforeinput once and leaves the native buffer empty', () => {
    const { input, send } = setup()
    const event = emit(input, 'beforeinput', { inputType: 'insertText', data: 'cat', isComposing: false })
    expect(event.defaultPrevented).toBe(true)
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'INSERT', text: 'cat', nowMs: 100 })
    emit(input, 'input', { inputType: 'insertText', data: 'cat', isComposing: false })
    expect(send).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('')
  })

  it('falls back to input when beforeinput cannot be canceled', () => {
    const { input, send } = setup()
    emit(input, 'beforeinput', { inputType: 'insertText', data: 'a', isComposing: false }, false)
    expect(send).not.toHaveBeenCalled()
    input.value = 'a'
    emit(input, 'input', { inputType: 'insertText', data: 'a', isComposing: false })
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'INSERT', text: 'a', nowMs: 100 })
  })

  it('commits composition once without counting composing keystrokes', () => {
    vi.useFakeTimers()
    const { input, send } = setup()
    emit(input, 'compositionstart')
    emit(input, 'beforeinput', { inputType: 'insertCompositionText', data: 'ca', isComposing: true })
    emit(input, 'input', { inputType: 'insertCompositionText', data: 'ca', isComposing: true })
    expect(send).not.toHaveBeenCalled()
    input.value = 'cat'
    emit(input, 'compositionend', { data: 'cat' })
    emit(input, 'beforeinput', { inputType: 'insertText', data: 'cat', isComposing: false })
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'INSERT', text: 'cat', nowMs: 100 })
    vi.runAllTimers()
    emit(input, 'beforeinput', { inputType: 'insertText', data: 'c', isComposing: false })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('blocks paste, drop, and their fallback input paths', () => {
    const { input, send } = setup()
    expect(emit(input, 'paste').defaultPrevented).toBe(true)
    expect(emit(input, 'drop').defaultPrevented).toBe(true)
    for (const inputType of ['insertFromPaste', 'insertFromDrop']) {
      emit(input, 'beforeinput', { inputType, data: 'cat' })
      input.value = 'cat'
      emit(input, 'input', { inputType, data: 'cat' })
    }
    expect(send).not.toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('maps backward deletion and preserves browser shortcuts and Tab', () => {
    const { input, send } = setup()
    expect(emit(input, 'keydown', { key: 'Backspace', ctrlKey: false, altKey: false, metaKey: false }).defaultPrevented).toBe(true)
    expect(send).toHaveBeenLastCalledWith({ type: 'DELETE_BACKWARD', nowMs: 100 })
    emit(input, 'keydown', { key: 'Backspace', ctrlKey: true })
    expect(send).toHaveBeenLastCalledWith({ type: 'DELETE_WORD_BACKWARD', nowMs: 100 })
    expect(emit(input, 'keydown', { key: 'Tab' }).defaultPrevented).toBe(false)
    expect(emit(input, 'keydown', { key: 'r', metaKey: true }).defaultPrevented).toBe(false)
  })

  it('maps software-keyboard backward deletion', () => {
    const { input, send } = setup()
    emit(input, 'beforeinput', { inputType: 'deleteContentBackward', data: null, isComposing: false })
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'DELETE_BACKWARD', nowMs: 100 })
  })

  it('removes native listeners and pending composition cleanup on unmount', () => {
    vi.useFakeTimers()
    const { input, send, cleanup } = setup()
    emit(input, 'compositionend', { data: 'a' })
    cleanup()
    send.mockClear()
    emit(input, 'beforeinput', { inputType: 'insertText', data: 'x', isComposing: false })
    expect(send).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

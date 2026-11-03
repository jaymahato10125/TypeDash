import type { TestConfig, TimePreset, WordPreset } from './types'

export function selectTime(config: TestConfig, durationSeconds: TimePreset): TestConfig {
  return { mode: 'time', durationSeconds, language: config.language, wordListVersion: config.wordListVersion, punctuation: config.punctuation, numbers: config.numbers }
}

export function selectWords(config: TestConfig, wordCount: WordPreset): TestConfig {
  return { mode: 'words', wordCount, language: config.language, wordListVersion: config.wordListVersion, punctuation: config.punctuation, numbers: config.numbers }
}

export function configurationKey(config: TestConfig): string {
  return [config.mode, config.mode === 'time' ? config.durationSeconds : config.wordCount, config.language, config.wordListVersion, Number(config.punctuation), Number(config.numbers)].join(':')
}

export function describeConfiguration(config: TestConfig): string {
  const label = `${config.language} / ${config.mode} ${config.mode === 'time' ? config.durationSeconds : config.wordCount}`
  const modifiers = [config.punctuation && 'punctuation', config.numbers && 'numbers'].filter(Boolean)
  return modifiers.length ? `${label} / ${modifiers.join(' + ')}` : label
}

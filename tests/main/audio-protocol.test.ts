import { join } from 'node:path'
import { expect, test } from 'vitest'
import { audioPathFor } from '../../src/main/audio-protocol'

test('maps a hashed mp3 name into contentDir/audio', () => {
  expect(audioPathFor('/c', 'course-audio://audio/0123456789abcdef.mp3')).toBe(
    join('/c', 'audio', '0123456789abcdef.mp3')
  )
})

test.each([
  'course-audio://audio/..%2F..%2Fx',
  'course-audio://audio/x/0123456789abcdef.mp3',
  'course-audio://audio/0123456789abcdef.wav',
  'course-audio://audio/0123456789abcde.mp3',
  'course-audio://other/0123456789abcdef.mp3'
])('refuses %s', (url) => {
  expect(audioPathFor('/c', url)).toBeNull()
})

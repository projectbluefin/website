<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { getChatlogLore } from '../lore'
import { CHAT_PAGE_CHARACTERS, pickPageIndexForElapsed } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'
import { splitReadableBeats } from './readable-beats'

/**
 * A transmission is a page display, exactly like every other lore record.
 *
 * It used to be a character-by-character typewriter on a `setInterval` started
 * at mount, which never read the player clock. That made it the one panel in
 * the show whose pace was its own opinion: it drifted against the music, it
 * could not be seeked or scrubbed, and it held its slot open past the end so
 * every record after it started late. A conversation timed to land on a beat
 * could only land on it by luck.
 *
 * Driving the page off `elapsed` makes the line on screen a function of the
 * clock, so it is the same on every machine and every rehearsal, and a line
 * anchored to a beat in the timeline arrives on that beat by construction.
 */
const props = defineProps<LoreViewProps>()

const conversation = computed(() => getChatlogLore(props.record))

interface ChatlogBeat {
  messageIndex: number
  beatIndex: number
  isContinuation: boolean
  speaker?: string
  text: string
  timestamp?: string
  isSfx?: boolean
}

const chatlogBeats = computed<ChatlogBeat[]>(() =>
  conversation.value.messages.flatMap((message, messageIndex) =>
    splitReadableBeats(message.text, CHAT_PAGE_CHARACTERS).map((text, beatIndex) => ({
      ...message,
      text,
      messageIndex,
      beatIndex,
      isContinuation: beatIndex > 0,
    })),
  ),
)

const activeBeatIndex = computed(() => pickPageIndexForElapsed(
  chatlogBeats.value.map(beat => beat.text),
  props.elapsed,
  props.duration,
))

const activeBeat = computed(() => chatlogBeats.value[activeBeatIndex.value] ?? null)

const headerSpec = computed(() => [
  ...conversation.value.channel
    ? [
        { key: 'channel', value: conversation.value.channel }
      ]
    : [],
  ...conversation.value.date
    ? [
        { key: 'date', value: conversation.value.date }
      ]
    : [],
])
</script>

<template>
  <section
    id="intercepted-communications"
    class="lore-dossier-panel"
    data-lore-view="chatlog"
    data-lore-view-kind="chatlog"
  >
    <LoreRecordHeader
      eyebrow="TRANSMISSION"
      :title="conversation.title"
      :spec="headerSpec"
    />

    <aside
      v-if="warning"
      class="lore-dossier-warning thesis-warning-fade"
      data-lore-warning
    >
      {{ warning }}
    </aside>

    <div class="quote-viewport">
      <Transition name="quote-fade" mode="out-in">
        <ol
          :key="`${record.id}-${activeBeatIndex}`"
          class="conversation-messages"
        >
          <li
            v-if="activeBeat"
            class="conversation-message"
            :class="{ 'sfx-message': activeBeat.isSfx }"
            :data-chatlog-beat-index="activeBeatIndex"
            :data-chatlog-message-index="activeBeat.messageIndex"
            :data-chatlog-beat-continuation="activeBeat.isContinuation"
          >
            <p v-if="activeBeat.isSfx" class="sfx-text">
              {{ activeBeat.text }}
            </p>
            <template v-else>
              <div class="conversation-message-header">
                <span class="conversation-speaker">{{ activeBeat.speaker }}</span>
                <time v-if="activeBeat.timestamp">{{ activeBeat.timestamp }}</time>
              </div>
              <p>{{ activeBeat.text }}</p>
            </template>
          </li>
        </ol>
      </Transition>
    </div>
  </section>
</template>

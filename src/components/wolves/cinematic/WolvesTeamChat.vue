<script setup lang="ts">
import type { WolvesTeamChatSequence } from '@/data/wolves-team-chats'
import { computed } from 'vue'
import { getVisibleWolvesTeamChatMessages, getWolvesTeamChatOpacity } from '@/data/wolves-team-chats'

// Renders the authored per-song CNCF team chat log, keyed to the real player
// clock (props, not the Pinia store directly) so the timing logic stays
// independently testable. This is a distinct content layer from the top HUD
// communications, the lower thesis overlay, and lore records — it never
// reuses or replaces their text.
const props = defineProps<{
  elapsedSeconds: number
  sequence: WolvesTeamChatSequence
}>()

const messages = computed(() =>
  getVisibleWolvesTeamChatMessages(props.sequence, props.elapsedSeconds),
)
const opacity = computed(() =>
  getWolvesTeamChatOpacity(props.sequence, props.elapsedSeconds),
)
</script>

<template>
  <aside
    v-if="messages.length > 0 && opacity > 0"
    class="wc-team-chat"
    :style="{ opacity }"
    aria-label="CNCF projects team chat"
  >
    <div class="wc-team-chat-log" role="log" aria-live="polite">
      <p v-for="message in messages" :key="`${message.atSeconds}-${message.speaker}`">
        <strong>{{ message.speaker }}</strong>
        <span>{{ message.text }}</span>
      </p>
    </div>
    <nav class="wc-team-chat-commands" aria-label="CNCF contributor resources">
      <a href="https://contribute.cncf.io" target="_blank" rel="noopener noreferrer">
        xdg-open contribute.cncf.io
      </a>
      <a href="https://ask.cncf.io" target="_blank" rel="noopener noreferrer">
        xdg-open ask.cncf.io
      </a>
    </nav>
  </aside>
</template>

<style scoped lang="scss">
// Fixed above the media widget's 140px footer budget, centered in the safe
// area between the two desktop ad gutters (--wc-org-ad-gutter, defined in
// TheaterExperience.vue's gallery layout). Hidden below 1024px: no mobile
// chat design is authorized.
.wc-team-chat {
  position: fixed;
  left: 50%;
  bottom: 15rem;
  transform: translateX(-50%);
  z-index: 15;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: min(60rem, calc(100vw - 2 * clamp(12rem, 16vw, 18rem) - 4.8rem));
  min-height: 6rem;
  max-height: 18rem;
  padding: 1.2rem 1.6rem;
  overflow: hidden;
  background: var(--wc-panel);
  border: 1px solid var(--wc-line);
  border-radius: 0.4rem;
  pointer-events: auto;
}

.wc-team-chat-log {
  min-height: 0;
  max-height: 12rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-family: var(--wc-font-mono);
  font-size: 1.3rem;
  color: var(--wc-white);

  strong {
    margin-right: 0.6rem;
    color: var(--wc-gold);
  }
}

.wc-team-chat-commands {
  display: flex;
  gap: 1.6rem;
  flex-wrap: wrap;
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;

  a {
    color: var(--wc-grey);
    text-decoration: none;

    &:hover,
    &:focus-visible {
      color: var(--wc-gold);
    }
  }
}

@media (max-width: 1023px) {
  .wc-team-chat {
    display: none; // no mobile chat design is authorized
  }
}
</style>

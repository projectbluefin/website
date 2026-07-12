<script setup lang="ts">
import { bazziteQuotes } from './lore'

// Replace these placeholders with the approved final Discord quotes before launch.
</script>

<template>
  <section
    id="intercepted-communications"
    class="dispatch-quote-section comic-reader-section"
    aria-labelledby="wolves-lore-title"
  >
    <div class="dispatch-quote-card">
      <div class="dispatch-plan-content">
        <p class="dispatch-plan-command">
          nimbinatus@blue-universal:~$ monitor --archive
        </p>
        <h2 id="wolves-lore-title" class="title-h2">
          Recovered Transmissions
        </h2>
        <p class="title-p">
          Static placeholder archive until the approved Discord quotes are cleared for publication.
        </p>
      </div>

      <ol class="lore-list" aria-label="Recovered transmissions">
        <li
          v-for="(quote, index) in bazziteQuotes"
          :key="`${quote.attribution}-${index}`"
          class="lore-list-item"
        >
          <article class="lore-entry">
            <p class="lore-quote-text">
              &ldquo;{{ quote.quote }}&rdquo;
            </p>
            <footer class="lore-quote-meta">
              <strong>{{ quote.attribution }}</strong>
              <span v-if="quote.context">{{ quote.context }}</span>
              <time v-if="quote.date" :datetime="quote.date">{{ quote.date }}</time>
            </footer>
          </article>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped lang="scss">
.dispatch-quote-section {
  @media (min-width: 1024px) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
}

.dispatch-quote-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid #272727;
  border-radius: 16px;
  background-color: #10151f;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);

  @media (min-width: 1024px) {
    flex: 1;
  }
}

.dispatch-plan-content {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--color-blue-rgb), 0.22);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(16, 21, 31, 0.98) 0%, rgba(12, 16, 22, 0.98) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.dispatch-plan-command,
.title-p {
  margin: 0;
  color: rgba(189, 189, 189, 0.85);
}

.dispatch-plan-command {
  font-size: 0.86rem;
}

.title-h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #ffffff;
}

.title-p {
  font-size: 0.9rem;
  line-height: 1.5;
}

.lore-list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lore-list-item {
  margin: 0;
}

.lore-entry {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(var(--color-blue-rgb), 0.2);
  border-radius: 14px;
  background: rgba(9, 13, 22, 0.78);
}

.lore-quote-text {
  margin: 0;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 1.05rem;
  font-style: italic;
  line-height: 1.7;
}

.lore-quote-meta {
  display: grid;
  gap: 4px;
  color: rgba(189, 189, 189, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
}

.lore-quote-meta strong {
  color: var(--color-blue);
  font-size: 0.96rem;
}

.lore-quote-meta time {
  color: rgba(189, 189, 189, 0.62);
}
</style>

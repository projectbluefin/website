<script setup lang="ts">
import { useI18n } from "vue-i18n"
import type { MessageSchema } from "../../locales/schema"
const { t } = useI18n<MessageSchema>({
  useScope: "global"
})
</script>

<template>
  <section id="community" class="section-wrap">
    <div class="container">
      <div class="community-content">
        <div class="community-header">
          <div class="community-tag">
            <strong>{{ t("Community.Tag") }}</strong>
          </div>
          <h2>{{ t("Community.Title") }}</h2>
        </div>

        <div class="community-card">
          <div class="card-icon">
            <a href="https://docs.projectbluefin.io" target="_blank" title="View Documentation">
              <img loading="lazy" src="/icons/docs.svg" alt="Bluefin Documentation" width="200" height="200">
            </a>
          </div>
          <div class="card-content">
            <h3>{{ t("Community.Documentation.Title") }}</h3>
            <p>{{ t("Community.Documentation.Description") }}</p>
            <div class="card-buttons">
              <a class="community-button" href="https://docs.projectbluefin.io" target="_blank">
                <span class="button-icon">
                  <i class="fas fa-file" aria-hidden="true"></i>
                </span>
                <span class="button-label">{{ t("Community.Documentation.Button") }}</span>
              </a>
              <a class="community-button" href="https://discord.gg/WYCpGEM4sM" target="_blank">
                <span class="button-icon">
                  <i class="fab fa-discord" aria-hidden="true"></i>
                </span>
                <span class="button-label">{{ t("Community.Documentation.DiscordButton") }}</span>
              </a>
              <a class="community-button" href="https://github.com/ublue-os/bluefin/discussions" target="_blank">
                <span class="button-icon">
                  <i class="fas fa-comments" aria-hidden="true"></i>
                </span>
                <span class="button-label">{{ t("Community.Documentation.DiscussionsButton") }}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="community-card contribute-card">
          <div class="contrib-text">
            <h3>{{ t("Community.Contribute.Title") }}</h3>
            <p>{{ t("Community.Contribute.Description") }}</p>
            <div class="card-buttons">
              <a class="community-button" href="https://github.com/ublue-os/bluefin" target="_blank">
                <span class="button-icon">
                  <i class="fab fa-github" aria-hidden="true"></i>
                </span>
                <span class="button-label">{{ t("Community.Contribute.Button") }}</span>
              </a>
              <a class="community-button" href="https://docs.projectbluefin.io/donations" target="_blank">
                <span class="button-icon">
                  <i class="fas fa-heart" aria-hidden="true"></i>
                </span>
                <span class="button-label">{{ t("Community.Contribute.DonateButton") }}</span>
              </a>
            </div>
          </div>
          <div class="contrib-image">
            <a href="https://github.com/ublue-os/bluefin/pulse" target="_blank" title="View Bluefin's Pulse on GitHub">
              <img src="https://repobeats.axiom.co/api/embed/40b85b252bf6ea25eb90539d1adcea013ccae69a.svg" alt="GitHub Repository Metrics" loading="lazy" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
#community {
  background-color: var(--color-bg);
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .community-content {
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .community-header {
    text-align: left;
    
    .community-tag {
      margin-bottom: 10px;

      strong {
        font-size: 2rem;
        font-weight: 400;
        text-transform: uppercase;
        color: var(--color-text-light);
        display: block;
      }
    }
    
    h2 {
      font-family: Inter;
      font-weight: 700;
      font-size: 7rem;
      text-transform: uppercase;
      color: var(--color-text-light);
      margin: 0 0 20px 0;
    }
  }

  .community-card {
    display: flex;
    gap: 40px;
    align-items: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid var(--color-border);

    .card-icon {
      flex-shrink: 0;
      text-align: center;
      max-width: 250px;

      img {
        max-width: 200px;
        height: auto;
      }
    }

    .card-content {
      flex: 1;

      h3 {
        font-size: 2.4rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 16px;
      }

      p {
        font-size: 1.6rem;
        line-height: 1.6;
        color: var(--color-text-light);
        margin-bottom: 24px;
      }

      .card-buttons {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }

      .community-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: var(--color-blue);
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-size: 1.4rem;
        font-weight: 600;
        transition: background 0.3s ease;

        &:hover {
          background: var(--color-blue-dark, #0056b3);
        }

        .button-icon {
          display: flex;
          align-items: center;
        }
      }
    }
  }

  .contribute-card {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 40px;
    align-items: start;

    .contrib-text {
      h3 {
        font-size: 2.4rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 16px;
      }

      p {
        font-size: 1.6rem;
        line-height: 1.6;
        color: var(--color-text-light);
        margin-bottom: 24px;
      }

      .card-buttons {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }

      .community-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: var(--color-blue);
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-size: 1.4rem;
        font-weight: 600;
        transition: background 0.3s ease;

        &:hover {
          background: var(--color-blue-dark, #0056b3);
        }

        .button-icon {
          display: flex;
          align-items: center;
        }
      }
    }

    .contrib-image {
      img {
        width: 100%;
        height: auto;
        display: block;
      }
    }
  }

  @media (max-width: 768px) {
    .community-card {
      flex-direction: column;
      text-align: center;
      padding: 24px;

      .card-icon {
        max-width: 150px;
      }

      .card-content .card-buttons {
        justify-content: center;
      }
    }

    .contribute-card {
      grid-template-columns: 1fr;
      
      .contrib-text .card-buttons {
        justify-content: center;
      }
    }

    .community-header h2 {
      font-size: 4rem;
    }
  }
}
</style>

import localtunnel from 'localtunnel';
import ON_DEATH from 'death';
import { mainLog } from './logger.js';
import { ApiClient } from './apiclient.js';
const LOG = mainLog();

/**
 * Responsible for cleanup when script is terminated. For now shutsdown any http tunneling and unregisters webhooks
 */
class TerminationHandler {
  apiClient: ApiClient = null;
  createdTunnel: localtunnel.Tunnel = null;
  handledTermination = false;
  createdWebhooks: string[] = [];

  async terminate(signal: unknown): Promise<void> {
    if (this.handledTermination) {
      return;
    }
    this.handledTermination = true;
    LOG.info('Received terminal signal', signal);
    if (this.createdTunnel) {
      this.createdTunnel.close();
    }
    await this.deleteInstalledWebhooks(this.createdWebhooks);
  }

  /** Ensure webhooks installed by the app are cleanup on process exit */
  async deleteInstalledWebhooks(webhooks: string[]): Promise<void> {
    if (this.apiClient) {
      for (const webhookId of webhooks) {
        await this.apiClient.delete(`api/webhooks/${webhookId}`);
      }
    }
  }

  set tunnel(tunnel: localtunnel.Tunnel) {
    this.createdTunnel = tunnel;
    tunnel.on('close', () => {
      LOG.info(`Local tunneling to ${tunnel.url} has been closed`);
    });
    tunnel.on('error', (err) => {
      LOG.error(`Local tunneling to ${tunnel.url} has error`, err);
    });
  }
}

export const terminationHandler = new TerminationHandler();

// eslint-disable-next-line new-cap
ON_DEATH(async function (signal) {
  try {
    await terminationHandler.terminate(signal);
  } catch (error) {
    LOG.error('TerminalHandler error', error);
  } finally {
    process.exit(0);
  }
});

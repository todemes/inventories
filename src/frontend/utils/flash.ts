import { FlashMessage } from '../types';

export class FlashMessageManager {
  private static container: HTMLElement | null = null;
  private static timeout: number = 5000; // 5 seconds

  static init(containerId: string = 'flash-messages'): void {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Flash message container not found');
    }
  }

  static show(message: string, type: FlashMessage['type'] = 'info'): void {
    if (!this.container) {
      console.error('Flash message container not initialized');
      return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = `alert alert-${type} alert-dismissible fade show`;
    messageElement.setAttribute('role', 'alert');
    
    messageElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    this.container.appendChild(messageElement);

    // Auto-dismiss after timeout
    setTimeout(() => {
      messageElement.classList.remove('show');
      setTimeout(() => messageElement.remove(), 300);
    }, this.timeout);
  }

  static success(message: string): void {
    this.show(message, 'success');
  }

  static error(message: string): void {
    this.show(message, 'danger');
  }

  static warning(message: string): void {
    this.show(message, 'warning');
  }

  static info(message: string): void {
    this.show(message, 'info');
  }
} 
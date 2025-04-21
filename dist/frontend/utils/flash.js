"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashMessageManager = void 0;
class FlashMessageManager {
    static init(containerId = 'flash-messages') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Flash message container not found');
        }
    }
    static show(message, type = 'info') {
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
    static success(message) {
        this.show(message, 'success');
    }
    static error(message) {
        this.show(message, 'danger');
    }
    static warning(message) {
        this.show(message, 'warning');
    }
    static info(message) {
        this.show(message, 'info');
    }
}
exports.FlashMessageManager = FlashMessageManager;
FlashMessageManager.container = null;
FlashMessageManager.timeout = 5000; // 5 seconds

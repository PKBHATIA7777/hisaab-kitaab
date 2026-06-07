/**
 * FormValidator — single validation system for all forms.
 * Replaces the four separate validation approaches.
 */
class FormValidator {
  constructor(formEl) {
    this.form = formEl;
    this._rules = new Map();
    this._cleanups = new Map();
  }

  rule(fieldName, validateFn, { immediate = false } = {}) {
    this._rules.set(fieldName, validateFn);
    
    const input = this.form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (!input) return this;

    // Create error element once
    const errorId = `${fieldName}-error`;
    let errorEl = document.getElementById(errorId);
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = errorId;
      errorEl.className = 'form-error';
      errorEl.setAttribute('aria-live', 'polite');
      errorEl.setAttribute('role', 'alert');
      input.insertAdjacentElement('afterend', errorEl);
      input.setAttribute('aria-describedby', errorId);
    }

    const validate = () => {
      const msg = validateFn(input.value);
      if (msg) {
        input.classList.add('form-input--error');
        input.classList.remove('form-input--success');
        input.setAttribute('aria-invalid', 'true');
        errorEl.textContent = msg;
        errorEl.classList.add('is-visible');
        return false;
      } else {
        input.classList.remove('form-input--error');
        if (input.value.trim()) input.classList.add('form-input--success');
        input.removeAttribute('aria-invalid');
        errorEl.classList.remove('is-visible');
        return true;
      }
    };

    input.addEventListener('input', validate);
    if (immediate) validate();
    
    this._cleanups.set(fieldName, () => {
      input.removeEventListener('input', validate);
    });

    return this; // chainable
  }

  validateAll() {
    let valid = true;
    for (const [name] of this._rules) {
      const input = this.form.querySelector(`[name="${name}"], #${name}`);
      if (!input) continue;
      const msg = this._rules.get(name)(input.value);
      if (msg) {
        valid = false;
        // Trigger visual error
        input.dispatchEvent(new Event('input'));
      }
    }
    if (!valid) {
      const firstError = this.form.querySelector('.form-input--error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError?.focus({ preventScroll: true });
    }
    return valid;
  }

  destroy() {
    this._cleanups.forEach(fn => fn());
    this._cleanups.clear();
  }
}

window.FormValidator = FormValidator;
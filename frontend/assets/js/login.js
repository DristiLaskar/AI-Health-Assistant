document.addEventListener('DOMContentLoaded', () => {
    const signInForm = $('#signin-form');
    const signUpForm = $('#signup-form');
    const notice = $('#notice');

    const swap = (show, hide, focusId) => {
        hide.hidden = true;
        show.hidden = false;
        hideNotice(notice);
        const field = $(focusId);
        if (field) field.focus();
    };

    $('#to-signup').addEventListener('click', () => swap(signUpForm, signInForm, '#signup-username'));
    $('#to-signin').addEventListener('click', () => swap(signInForm, signUpForm, '#signin-username'));

    const submitting = (form, busy, label) => {
        const button = form.querySelector('button[type="submit"]');
        button.disabled = busy;
        button.textContent = label;
    };

    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideNotice(notice);
        submitting(signInForm, true, 'Signing in…');

        try {
            const result = await api('/auth/signin', {
                method: 'POST',
                body: JSON.stringify({
                    username: $('#signin-username').value,
                    password: $('#signin-password').value
                })
            });
            window.location.href = result.redirectUrl || '/home';
        } catch (error) {
            showNotice(notice, error.message);
            submitting(signInForm, false, 'Sign in');
        }
    });

    signUpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideNotice(notice);
        submitting(signUpForm, true, 'Creating…');

        const username = $('#signup-username').value;
        const password = $('#signup-password').value;

        try {
            await api('/auth/signup', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            // Sign the new account straight in rather than making them retype it.
            const result = await api('/auth/signin', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            window.location.href = result.redirectUrl || '/onboarding';
        } catch (error) {
            showNotice(notice, error.message);
            submitting(signUpForm, false, 'Create account');
        }
    });
});

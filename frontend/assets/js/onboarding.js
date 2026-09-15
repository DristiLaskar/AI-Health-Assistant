document.addEventListener('DOMContentLoaded', () => {
    const TOTAL = 2;
    const notice = $('#notice');
    const nextBtn = $('#next-btn');
    const backBtn = $('#back-btn');

    let step = 1;
    const picked = { conditions: [], allergies: [] };

    const COMMON = {
        conditions: ['Asthma', 'Diabetes', 'High blood pressure', 'Migraine', 'Thyroid', 'Anaemia', 'PCOS', 'Anxiety'],
        allergies: ['Penicillin', 'Dust', 'Pollen', 'Peanuts', 'Lactose', 'Shellfish']
    };

    /* --- steps ----------------------------------------------------------- */

    const render = () => {
        $$('.step').forEach((section) => {
            section.classList.toggle('is-active', Number(section.dataset.step) === step);
        });
        $$('.progress span').forEach((bar) => {
            bar.classList.toggle('is-done', Number(bar.dataset.bar) <= step);
        });
        backBtn.hidden = step === 1;
        nextBtn.textContent = step === TOTAL ? 'Save and continue' : 'Continue';
    };

    const validate = () => {
        if (step !== 1) return null;
        if (!$('input[name="gender"]:checked')) return 'Pick one option so we know how to address you.';
        const age = Number($('#age').value);
        if (!age || age < 1 || age > 120) return 'Enter an age between 1 and 120.';
        return null;
    };

    /* --- tag inputs ------------------------------------------------------ */

    const paint = (key) => {
        const list = $(`#${key === 'conditions' ? 'condition' : 'allergy'}-tags`);
        list.innerHTML = '';

        picked[key].forEach((value) => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = value;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.innerHTML = '&times;';
            remove.setAttribute('aria-label', `Remove ${value}`);
            remove.addEventListener('click', () => {
                picked[key] = picked[key].filter((item) => item !== value);
                paint(key);
            });

            tag.appendChild(remove);
            list.appendChild(tag);
        });

        const suggestions = $(`#${key === 'conditions' ? 'condition' : 'allergy'}-suggestions`);
        suggestions.innerHTML = '';
        COMMON[key]
            .filter((option) => !picked[key].includes(option))
            .forEach((option) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = option;
                button.addEventListener('click', () => add(key, option));
                suggestions.appendChild(button);
            });
    };

    const add = (key, raw) => {
        const value = String(raw || '').trim().slice(0, 40);
        if (!value) return;
        const exists = picked[key].some((item) => item.toLowerCase() === value.toLowerCase());
        if (!exists && picked[key].length < 15) picked[key].push(value);
        paint(key);
    };

    [['conditions', '#condition-input'], ['allergies', '#allergy-input']].forEach(([key, selector]) => {
        const input = $(selector);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                add(key, input.value);
                input.value = '';
            }
            if (event.key === 'Backspace' && !input.value && picked[key].length) {
                picked[key].pop();
                paint(key);
            }
        });
        input.addEventListener('blur', () => {
            if (input.value.trim()) {
                add(key, input.value);
                input.value = '';
            }
        });
    });

    /* --- navigation ------------------------------------------------------ */

    backBtn.addEventListener('click', () => {
        if (step > 1) step -= 1;
        hideNotice(notice);
        render();
    });

    nextBtn.addEventListener('click', async () => {
        const problem = validate();
        if (problem) {
            showNotice(notice, problem);
            return;
        }
        hideNotice(notice);

        if (step < TOTAL) {
            step += 1;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        nextBtn.disabled = true;
        nextBtn.textContent = 'Saving…';

        try {
            const result = await api('/api/onboarding', {
                method: 'POST',
                body: JSON.stringify({
                    gender: $('input[name="gender"]:checked').value,
                    age: $('#age').value,
                    height: $('#height').value,
                    weight: $('#weight').value,
                    conditions: picked.conditions,
                    allergies: picked.allergies
                })
            });
            window.location.href = result.redirectUrl || '/home';
        } catch (error) {
            showNotice(notice, error.message);
            nextBtn.disabled = false;
            nextBtn.textContent = 'Save and continue';
        }
    });

    $('#onboarding-form').addEventListener('submit', (event) => {
        event.preventDefault();
        nextBtn.click();
    });

    paint('conditions');
    paint('allergies');
    render();
});

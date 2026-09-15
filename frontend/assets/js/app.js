document.addEventListener('DOMContentLoaded', () => {
    const form = $('#analyse-form');
    const textarea = $('#problem');
    const button = $('#analyse-btn');
    const counter = $('#count');
    const notice = $('#notice');
    const thinking = $('#thinking');
    const report = $('#report');

    /* --- small maps ------------------------------------------------------ */

    const URGENCY_KEY = {
        'Self-care': 'self',
        'See a clinician soon': 'soon',
        'Seek urgent care': 'urgent'
    };

    const LIKELIHOOD_RANK = { Low: 1, Moderate: 2, High: 3 };

    // "back" is felt in the torso; "skin" and "general" affect the whole body.
    const REGION_TO_SHAPES = {
        back: ['chest', 'abdomen'],
        skin: ['head', 'throat', 'chest', 'abdomen', 'pelvis', 'arms', 'hands', 'legs', 'feet'],
        general: ['head', 'throat', 'chest', 'abdomen', 'pelvis', 'arms', 'hands', 'legs', 'feet']
    };

    const scoreColour = (score) => {
        if (score >= 7) return 'var(--low)';
        if (score >= 4) return 'var(--moderate)';
        return 'var(--high)';
    };

    const scoreWords = (score, kind) => {
        if (score >= 8) return `Looking steady on the ${kind} side.`;
        if (score >= 6) return `Mostly fine, with something worth watching.`;
        if (score >= 4) return `Noticeably affected right now.`;
        return `Taking a real toll at the moment.`;
    };

    /* --- profile and history rail ---------------------------------------- */

    const loadRail = async () => {
        try {
            const me = await api('/api/user');
            const p = me.profile || {};
            const rows = [
                ['Name', me.username],
                ['Age', p.age],
                ['Gender', p.gender],
                ['Height', p.height ? `${p.height} cm` : null],
                ['Weight', p.weight ? `${p.weight} kg` : null],
                ['Conditions', p.conditions && p.conditions.length ? p.conditions.join(', ') : 'None listed'],
                ['Allergies', p.allergies && p.allergies.length ? p.allergies.join(', ') : 'None listed']
            ].filter(([, value]) => value);

            $('#profile-summary').innerHTML = rows
                .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
                .join('');
        } catch (error) {
            $('#profile-summary').innerHTML = '';
        }

        try {
            const { history } = await api('/api/history');
            if (!history || !history.length) return;

            const list = $('#history-list');
            list.innerHTML = '';
            history.forEach((entry) => {
                const li = document.createElement('li');
                const item = document.createElement('button');
                item.type = 'button';
                const when = new Date(entry.createdAt);
                item.innerHTML = `${esc(entry.query.slice(0, 64))}${entry.query.length > 64 ? '&hellip;' : ''}
                    <small>${esc(when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</small>`;
                item.addEventListener('click', () => {
                    textarea.value = entry.query;
                    textarea.focus();
                    counter.textContent = textarea.value.length;
                });
                li.appendChild(item);
                list.appendChild(li);
            });
        } catch (error) {
            /* the rail is optional context, so a failure here stays quiet */
        }
    };

    /* --- report pieces --------------------------------------------------- */

    const bodyFigure = (symptoms, level) => {
        const svg = $('#body-template').content.cloneNode(true).querySelector('svg');
        svg.dataset.level = level;

        const wanted = new Set();
        symptoms.forEach((symptom) => {
            const shapes = REGION_TO_SHAPES[symptom.region] || [symptom.region];
            shapes.forEach((shape) => wanted.add(shape));
        });

        $$('.region', svg).forEach((shape) => {
            if (wanted.has(shape.dataset.region)) shape.classList.add('is-flagged');
        });

        return svg.outerHTML;
    };

    const meter = (label, score, kind) => {
        const ticks = Array.from({ length: 10 }, (_, i) =>
            `<i class="${i < score ? 'on' : ''}"></i>`
        ).join('');

        return `
            <div class="meter" style="--meter:${scoreColour(score)}">
                <div class="meter__head">
                    <h3>${esc(label)}</h3>
                    <span class="meter__value">${score}<small>/10</small></span>
                </div>
                <div class="meter__ticks" role="img" aria-label="${score} out of 10">${ticks}</div>
                <p class="meter__note">${esc(scoreWords(score, kind))}</p>
            </div>`;
    };

    const likelihood = (level) => {
        const rank = LIKELIHOOD_RANK[level] || 1;
        const boxes = [1, 2, 3].map((n) => `<i class="${n <= rank ? 'on' : ''}"></i>`).join('');
        return `<span class="likelihood" data-rank="${rank}">${boxes} ${esc(level)}</span>`;
    };

    const section = (title, inner) => `<section><h2>${esc(title)}</h2>${inner}</section>`;

    const render = (data) => {
        const level = URGENCY_KEY[data.urgency] || 'soon';
        const parts = [];

        parts.push(`
            <section>
                <p class="summary">${esc(data.summary)}</p>
                <div class="urgency" data-level="${level}">
                    <h3>${esc(data.urgency)}</h3>
                    <p>${esc(data.urgencyReason)}</p>
                </div>
            </section>`);

        if (data.symptoms.length) {
            parts.push(section('Where it shows up', `
                <div class="vitals">
                    <div class="figure-wrap">
                        ${bodyFigure(data.symptoms, level)}
                        <ul class="symptom-list" data-level="${level}">
                            ${data.symptoms.map((s) => `
                                <li>
                                    <span class="dot"></span>
                                    <span><strong>${esc(s.name)}</strong>
                                    ${s.note ? `<em> — ${esc(s.note)}</em>` : ''}</span>
                                </li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        ${meter('Physical wellbeing', data.physicalScore, 'physical')}
                        ${meter('Mental wellbeing', data.mentalScore, 'mental')}
                    </div>
                </div>`));
        }

        if (data.conditions.length) {
            parts.push(section('What this could be', data.conditions.map((c) => `
                <div class="condition">
                    <div class="condition__head">
                        <h3>${esc(c.name)}</h3>
                        ${likelihood(c.likelihood)}
                    </div>
                    <p>${esc(c.explanation)}</p>
                    ${c.matches.length
                        ? `<ul class="matches">${c.matches.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
                        : ''}
                </div>`).join('')));
        }

        if (data.remedies.length) {
            parts.push(section('What you can do', `
                <div class="remedies">
                    ${data.remedies.map((r) => `
                        <div class="remedy" data-type="${esc(r.type)}">
                            <span class="kind">${esc(r.type)}</span>
                            <h3>${esc(r.title)}</h3>
                            <p>${esc(r.detail)}</p>
                        </div>`).join('')}
                </div>`));
        }

        if (data.redFlags.length) {
            parts.push(section('Stop and get help if', `
                <ul class="checklist checklist--warn">
                    ${data.redFlags.map((flag) => `<li>${esc(flag)}</li>`).join('')}
                </ul>`));
        }

        if (data.questionsForClinician.length) {
            parts.push(section('Worth asking a clinician', `
                <ul class="checklist">
                    ${data.questionsForClinician.map((q) => `<li>${esc(q)}</li>`).join('')}
                </ul>`));
        }

        if (data.tip) {
            parts.push(`<section><p class="tip">${esc(data.tip)}</p></section>`);
        }

        parts.push(`
            <div class="report-foot">
                <p class="disclaimer">Generated by an AI model from what you wrote. It can be
                wrong and it is not a diagnosis. Check anything that worries you with a clinician.</p>
            </div>`);

        report.innerHTML = parts.join('');
        report.hidden = false;
    };

    /* --- submit ---------------------------------------------------------- */

    textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const problem = textarea.value.trim();

        if (problem.length < 5) {
            showNotice(notice, 'Describe how you are feeling in a sentence or two.');
            textarea.focus();
            return;
        }

        hideNotice(notice);
        report.hidden = true;
        thinking.hidden = false;
        button.disabled = true;
        button.textContent = 'Working…';

        try {
            const data = await api('/api/analyze', {
                method: 'POST',
                body: JSON.stringify({ problem })
            });
            render(data);
            report.scrollIntoView({ behavior: 'smooth', block: 'start' });
            loadRail();
        } catch (error) {
            showNotice(notice, error.message);
        } finally {
            thinking.hidden = true;
            button.disabled = false;
            button.textContent = 'Get an assessment';
        }
    });

    loadRail();
});

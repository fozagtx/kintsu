const form = document.getElementById('signup');
const terms = document.getElementById('terms');
const submit = document.getElementById('submit');
const error = document.getElementById('error');
const welcome = document.getElementById('welcome');
const welcomeText = document.getElementById('welcome-text');

const PLAN_NAMES = { free: 'Free', team: 'Team', pro: 'Pro' };

const sync = () => {
  submit.disabled = !terms.checked;
};
terms.addEventListener('change', sync);
sync();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;

  const data = Object.fromEntries(new FormData(form));
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: data.name, email: data.email, plan: data.plan, terms: terms.checked }),
  });
  const body = await res.json();

  if (!res.ok) {
    error.textContent = body.error;
    error.hidden = false;
    return;
  }

  const { account } = body;
  welcomeText.textContent = `Welcome, ${account.name}. You're on the ${PLAN_NAMES[account.plan]} plan.`;
  form.hidden = true;
  welcome.hidden = false;
});

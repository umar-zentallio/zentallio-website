/* "Not screens. Decisions." timeline — lights the step in the middle of the screen and syncs the sticky tracker */
(function () {
  var root = document.getElementById('mJourney');
  if (!root) return;
  var steps = [].slice.call(root.querySelectorAll('.m-jr-step'));
  var st = document.getElementById('mJrSt'), bar = document.getElementById('mJrBar');
  var cur = -1;

  function set(n) {
    if (n === cur) return;
    cur = n;
    steps.forEach(function (s, k) {
      s.classList.toggle('is-on', k === n);
      s.classList.toggle('is-done', k < n);
    });
    var sc = steps[n].style.getPropertyValue('--sc');
    root.style.setProperty('--sc', sc);
    st.textContent = steps[n].dataset.st;
    bar.style.width = ((n + 1) / steps.length * 100) + '%';
  }

  set(0);
  if (!('IntersectionObserver' in window)) return;
  // a thin band across the middle of the viewport decides which step is "live"
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) set(steps.indexOf(e.target));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  steps.forEach(function (s) { io.observe(s); });
})();

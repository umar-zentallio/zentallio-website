/* Ask Iris card — Fashion Retail questions (read by /m/ask-iris.js, so load this first).
   Every figure comes from the desktop fashion page: the tour's Ask Iris, Inventory,
   Pricing, Returns and Dashboard screens, and the scorecard's markdown beat. */
(function () {
  var pct = function (v) { return v + '%'; };
  window.M_ASK_QA = [
    { q: 'Where is the M coat selling out?',
      a: '<b>Core M is breaking in 14 stores</b> — out in <em class="bad">6 days</em>, while XS/XXL sit <em class="am">31%</em> overstocked.',
      unit: 'Weeks of cover · Aria Wool Coat', max: 5, fmt: function (v) { return v + 'w'; }, wide: true,
      bars: [{ l: 'Marseille', v: 1.8, c: 'hot' }, { l: 'Lyon', v: 2.1, c: 'hot' }, { l: 'Bordeaux', v: 5.0 }],
      act: { d: 'Rebalance 40 × M from slow doors', m: 'Hold full price on core', b: 'Approve' } },
    { q: 'Which channel has the best margin?',
      a: '<b>Store POS</b> at <em class="up">41.2%</em> — Amazon is lowest at <em class="bad">28.1%</em> once its fee lands.',
      unit: 'Net margin · Aria Wool Coat', max: 45, fmt: pct,
      bars: [{ l: 'Store', v: 41.2, c: 'hi' }, { l: 'Web', v: 39.8 }, { l: 'Amazon', v: 28.1, c: 'hot' }] },
    { q: 'What’s driving returns this week?',
      a: '<b>Size &amp; fit</b> — <em class="am">46%</em> of returns, clustered on two slim styles.',
      unit: 'Return reasons · share', max: 50, fmt: pct, wide: true,
      bars: [{ l: 'Size &amp; fit', v: 46, c: 'hot' }, { l: 'Changed mind', v: 28 }, { l: 'Defect', v: 14 }],
      act: { d: 'Flag the size spec, trim tail re-buy', m: 'Before the next order ships', b: 'Approve' } },
    { q: 'Give me today’s board across every channel.',
      a: 'Done — <b>1,284</b> orders today, gross margin holding at <em class="up">58.4%</em>.',
      kpis: [{ l: 'Revenue · MTD', v: '$36.0M' }, { l: 'Orders today', v: '1,284' },
             { l: 'Sell-through', v: '62%' }, { l: 'Gross margin', v: '58.4%' }] },
    { q: 'Should we mark down Women’s Outerwear?',
      a: '<b>Only the tail</b> — a size-targeted markdown costs <em class="up">0.4pt</em> of margin, a blanket one <em class="bad">2.1pt</em>.',
      unit: 'Margin cost · pt', max: 2.5, fmt: function (v) { return v + 'pt'; }, wide: true,
      bars: [{ l: 'Blanket', v: 2.1, c: 'hot' }, { l: 'Size-targeted', v: 0.4, c: 'hi' }],
      act: { d: 'Mark down XS/XXL only', m: 'Core M/L stays full price', b: 'Approve' } }
  ];
})();

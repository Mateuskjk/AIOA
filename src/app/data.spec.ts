import { Ticket, badge, code, countBy, duration, initials, kpiStats, monthlyTrend, perAgentAverage, sla, transcript, transcriptEntries, transcriptHtml } from './data';

const H = 3600e3;
const t = (p: Partial<Ticket>) => ({ id: 7, priority: 'Alta', status: 'Aberto', createdAt: Date.now(), updatedAt: Date.now(), ...p }) as Ticket;

describe('data helpers', () => {
  it('formats ticket codes with the A- prefix', () => {
    expect(code({ id: 7 })).toBe('A-007');
    expect(code({ id: 1234 })).toBe('A-1234');
  });

  it('computes SLA for open and closed tickets', () => {
    expect(sla(t({ createdAt: Date.now() - 2 * H })).label).toBe('Restam 6 h');
    expect(sla(t({ createdAt: Date.now() - 10 * H })).late).toBe(true);
    expect(sla(t({ status: 'Resolvido', createdAt: 0, resolvedAt: 5 * H })).label).toBe('Cumprido');
    expect(sla(t({ status: 'Fechado', createdAt: 0, resolvedAt: 9 * H })).label).toBe('Violado');
  });

  it('builds a full, ordered transcript including notes, events and attachments', () => {
    const text = transcript(
      t({
        title: 'Erro no PJe', company: 'LexFinance', system: 'LexHub', requester: 'Carla', assignee: 'Ana Rocha', description: 'Timeout',
        log: [{ at: 2000, text: 'Chamado atribuído a Ana Rocha' }],
        messages: [
          { author: 'Carla', body: 'Está dando timeout', at: 1000, via: 'WhatsApp' },
          { author: 'Ana Rocha', body: 'Verificar certificado', at: 3000, internal: true },
          { author: 'Carla', body: '', at: 4000, via: 'WhatsApp', files: [{ name: 'print.png', type: 'image/png', size: 1, url: '' }] },
        ],
      }),
    );
    expect(text).toContain('TRANSCRIÇÃO DO CHAMADO A-007');
    expect(text).toContain('Carla (via WhatsApp):\nEstá dando timeout');
    expect(text).toContain('Ana Rocha [NOTA INTERNA]:');
    expect(text).toContain('📎 Anexo: print.png');
    expect(text.indexOf('Está dando timeout')).toBeLessThan(text.indexOf('atribuído'));
    expect(text.indexOf('atribuído')).toBeLessThan(text.indexOf('NOTA INTERNA'));
    expect(text).toContain('3 mensagens, 1 eventos');
  });

  it('computes dashboard KPIs: resolution rate counts only finished tickets', () => {
    const k = kpiStats([
      t({ status: 'Aberto' }),
      t({ status: 'Em andamento' }),
      t({ status: 'Aguardando cliente' }),
      t({ status: 'Resolvido', createdAt: 0, resolvedAt: 2 * H }),
      t({ status: 'Fechado', createdAt: 0, resolvedAt: 4 * H }),
      t({ status: 'Cancelado' }),
      t({ status: 'Reprovado' }),
    ]);
    expect(k).toMatchObject({ total: 7, waiting: 1, inProgress: 2, resolved: 2, cancelled: 1, rejected: 1, finished: 4, rate: 50, avgHours: 3 });
    expect(kpiStats([]).rate).toBeNull();
  });

  it('snapshots a transcript up to a moment and exports it as safe HTML with media', () => {
    const ticket = t({
      log: [{ at: 1000, text: 'Chamado atribuído' }],
      messages: [
        { author: 'Carla', body: '<script>alert(1)</script>', at: 500 },
        { author: 'Ana', body: '', at: 1500, files: [
          { name: 'print.png', type: 'image/png', size: 1, url: 'data:image/png;base64,AA' },
          { name: 'Áudio 0:03', type: 'audio/webm', size: 1, url: 'data:audio/webm;base64,BB' },
        ] },
        { author: 'Ana', body: 'depois do encerramento', at: 9000 },
      ],
    });
    const entries = transcriptEntries(ticket, 2000);
    expect(entries.map((e) => e.kind)).toEqual(['msg', 'event', 'msg']); // the message at 9000 is after the snapshot
    const html = transcriptHtml({ code: 'A-007', title: 'T', company: 'C', requester: 'Carla' }, entries);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<img src="data:image/png;base64,AA"');
    expect(html).toContain('<audio controls src="data:audio/webm;base64,BB"');
  });

  it('ranks labels by count', () => {
    expect(countBy(['Ana', 'Bruno', 'Ana', 'Caio', 'Bruno', 'Ana'], 2)).toEqual([
      { label: 'Ana', value: 3 },
      { label: 'Bruno', value: 2 },
    ]);
  });

  it('builds a monthly trend of opened tickets and per-agent averages', () => {
    const now = new Date(2026, 9, 19).getTime(); // 19 Oct 2026
    const at = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
    const tickets = [
      t({ createdAt: at(2026, 9, 2), status: 'Aberto' }),
      t({ createdAt: at(2026, 8, 3), status: 'Resolvido', resolvedAt: at(2026, 8, 4), closedBy: 'Ana' }),
      t({ createdAt: at(2026, 8, 5), status: 'Resolvido', resolvedAt: at(2026, 8, 6), closedBy: 'Ana' }),
      t({ createdAt: at(2026, 8, 7), status: 'Fechado', resolvedAt: at(2026, 8, 8), closedBy: 'Bruno' }),
      t({ createdAt: at(2026, 8, 9), status: 'Cancelado', resolvedAt: at(2026, 8, 10), closedBy: 'Bruno' }),
      t({ createdAt: at(2025, 1, 1), status: 'Resolvido', resolvedAt: at(2025, 1, 2), closedBy: 'Ana' }), // outside 12 months
    ];
    const trend = monthlyTrend(tickets, now);
    expect(trend).toHaveLength(12);
    expect(trend[0].label).toContain('2025');
    expect(trend.at(-1)).toMatchObject({ opened: 1 });
    expect(trend.at(-2)).toMatchObject({ opened: 4 });
    // 2 resolved by Ana and 1 by Bruno in 12 months; cancelled doesn't count
    expect(perAgentAverage(tickets, now)).toEqual([
      { label: 'Ana', value: 0.17 },
      { label: 'Bruno', value: 0.08 },
    ]);
  });

  it('formats durations', () => {
    expect(duration(0.5)).toBe('30 min');
    expect(duration(5.25)).toBe('5 h 15 min');
    expect(duration(3)).toBe('3 h');
    expect(duration(32.9)).toBe('33 h');
    expect(duration(50)).toBe('2 d 2 h');
  });

  it('builds badge classes and initials', () => {
    expect(badge('Média')).toBe('badge b-media');
    expect(badge('Aguardando cliente')).toBe('badge b-aguardando-cliente');
    expect(initials('Carla — LexFinance')).toBe('CL');
  });
});

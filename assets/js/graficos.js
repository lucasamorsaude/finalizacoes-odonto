// Gráficos em SVG puro, seguindo a skill de dataviz:
// marcas finas (≤ 24 px), cantos de 4 px só na ponta, 2 px de respiro entre segmentos,
// grade em hairline sólida, legenda sempre presente, dica por marca (mouse e teclado) e visão em tabela.
// Cores vêm dos tokens --serie-* / --ordinal-* (paleta validada, claro e escuro).

const NS = 'http://www.w3.org/2000/svg';
const fmt = new Intl.NumberFormat('pt-BR');

function criar(tag, atributos = {}, pai = null) {
    const el = document.createElementNS(NS, tag);
    Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
    pai?.append(el);
    return el;
}

// Escala "bonita": 0, 5, 10... / 0, 20, 40...
function escala(maximo, alvoTicks = 4) {
    if (maximo <= 0) return { topo: 4, passo: 1 };
    const bruto = maximo / alvoTicks;
    const pot = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map(m => m * pot).find(p => p >= bruto);
    return { topo: Math.ceil(maximo / passo) * passo, passo };
}

// Retângulo com cantos arredondados só em um lado (a ponta do dado)
function caminhoBarra(x, y, l, a, raio, lado) {
    const r = Math.min(raio, a / 2, l / 2);
    if (r <= 0 || l <= 0 || a <= 0) return `M${x},${y}h${Math.max(l, 0)}v${Math.max(a, 0)}h${-Math.max(l, 0)}Z`;
    if (lado === 'topo') {
        return `M${x},${y + a}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + a}Z`;
    }
    return `M${x},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + a - r}Q${x + l},${y + a} ${x + l - r},${y + a}H${x}Z`;
}

// ── Dica (tooltip) ─────────────────────────────────────────────────────────

function criarDica(container) {
    const dica = document.createElement('div');
    dica.className = 'dica';
    dica.hidden = true;
    dica.setAttribute('role', 'presentation');
    container.append(dica);

    return {
        mostrar(titulo, linhas, ancoraX, ancoraY) {
            dica.replaceChildren();
            const t = document.createElement('div');
            t.className = 'titulo';
            t.textContent = titulo;
            dica.append(t);
            linhas.forEach(({ cor, nome, valor }) => {
                const item = document.createElement('div');
                item.className = 'item';
                const chave = document.createElement('i');
                chave.style.background = cor || 'transparent';
                const forte = document.createElement('strong');
                forte.textContent = valor;
                const rotulo = document.createElement('span');
                rotulo.textContent = nome;
                item.append(chave, forte, rotulo);
                dica.append(item);
            });
            dica.hidden = false;
            const largura = container.clientWidth;
            const { offsetWidth: w, offsetHeight: h } = dica;
            const x = Math.min(Math.max(ancoraX - w / 2, 0), largura - w);
            dica.style.left = `${x}px`;
            dica.style.top = `${Math.max(ancoraY - h - 10, 0)}px`;
        },
        esconder() { dica.hidden = true; },
    };
}

function legenda(series) {
    const ul = document.createElement('ul');
    ul.className = 'legenda';
    series.forEach(s => {
        const li = document.createElement('li');
        const amostra = document.createElement('i');
        amostra.style.background = s.cor;
        const nome = document.createElement('span');
        nome.textContent = s.rotuloLegenda ?? s.nome;
        li.append(amostra, nome);
        ul.append(li);
    });
    return ul;
}

// Alternância "Ver como tabela" — a versão acessível de todo gráfico
function visaoTabela(container, cabecalhos, linhas) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn--fantasma btn--sm alternar-tabela';
    botao.textContent = 'Ver como tabela';
    botao.setAttribute('aria-expanded', 'false');

    const caixa = document.createElement('div');
    caixa.className = 'tabela-rolagem';
    caixa.hidden = true;
    const tabela = document.createElement('table');
    tabela.className = 'tabela-dados';
    const thead = tabela.createTHead().insertRow();
    cabecalhos.forEach((c, i) => {
        const th = document.createElement('th');
        th.textContent = c;
        if (i > 0) th.className = 'direita';
        thead.append(th);
    });
    const tbody = tabela.createTBody();
    linhas.forEach(valores => {
        const tr = tbody.insertRow();
        valores.forEach((v, i) => {
            const td = tr.insertCell();
            td.textContent = typeof v === 'number' ? fmt.format(v) : v;
            if (i > 0) td.className = 'direita';
        });
    });
    caixa.append(tabela);

    botao.addEventListener('click', () => {
        caixa.hidden = !caixa.hidden;
        botao.setAttribute('aria-expanded', String(!caixa.hidden));
        botao.textContent = caixa.hidden ? 'Ver como tabela' : 'Ocultar tabela';
    });
    container.append(botao, caixa);
}

// Redesenha quando o container muda de largura
function responsivo(container, desenhar) {
    let larguraAnterior = 0;
    const observador = new ResizeObserver(() => {
        const largura = container.clientWidth;
        // Contêiner ainda sem layout (oculto ou em transição): espera a largura real
        if (largura < 120 || Math.abs(largura - larguraAnterior) < 4) return;
        larguraAnterior = largura;
        desenhar(largura);
    });
    observador.observe(container);
    return () => observador.disconnect();
}

// ── Colunas empilhadas (série temporal) ────────────────────────────────────

/**
 * @param container elemento .grafico
 * @param dados [{ rotulo: '02/10', titulo: 'Semana de 29/09', valores: { chave: n } }]
 * @param series [{ chave, nome, cor }]
 */
export function colunasEmpilhadas(container, { dados, series, altura = 240, descricao = '' }) {
    container._desligar?.();
    container.replaceChildren();
    container.append(legenda(series));

    const area = document.createElement('div');
    area.style.position = 'relative';
    container.append(area);
    const dica = criarDica(area);

    const desenhar = (largura) => {
        area.querySelector('svg')?.remove();
        const margem = { topo: 8, direita: 4, baixo: 26, esquerda: 36 };
        const plotL = largura - margem.esquerda - margem.direita;
        const plotA = altura - margem.topo - margem.baixo;
        const totais = dados.map(d => series.reduce((s, sr) => s + (d.valores[sr.chave] ?? 0), 0));
        const { topo, passo } = escala(Math.max(...totais, 0));
        const y = v => margem.topo + plotA - (v / topo) * plotA;
        const banda = plotL / Math.max(dados.length, 1);
        const larguraBarra = Math.max(2, Math.min(24, banda * 0.66));

        const svg = criar('svg', { viewBox: `0 0 ${largura} ${altura}`, role: 'img', 'aria-label': descricao });
        area.prepend(svg);

        // Grade e eixo Y
        for (let v = 0; v <= topo; v += passo) {
            criar('line', { class: v === 0 ? 'eixo-linha' : 'grade-linha', x1: margem.esquerda, x2: largura - margem.direita, y1: y(v), y2: y(v) }, svg);
            const t = criar('text', { x: margem.esquerda - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg);
            t.textContent = fmt.format(v);
        }

        // Rótulos do eixo X sem colisão
        const salto = Math.max(1, Math.ceil((dados.length * 40) / plotL));

        dados.forEach((d, i) => {
            const centro = margem.esquerda + banda * i + banda / 2;
            const grupo = criar('g', { class: 'grupo-barra' }, svg);
            let base = 0;
            const visiveis = series.filter(s => (d.valores[s.chave] ?? 0) > 0);
            visiveis.forEach((s, n) => {
                const valor = d.valores[s.chave];
                const yTopo = y(base + valor);
                const yBase = y(base);
                const ehTopo = n === visiveis.length - 1;
                // 2 px de respiro entre segmentos (a cor do fundo faz a separação)
                const alturaSeg = Math.max(yBase - yTopo - (n > 0 ? 2 : 0), 1);
                criar('path', {
                    class: 'seg', fill: s.cor,
                    d: caminhoBarra(centro - larguraBarra / 2, yTopo, larguraBarra, alturaSeg, ehTopo ? 4 : 0, 'topo'),
                }, grupo);
                base += valor;
            });

            if (i % salto === 0) {
                const t = criar('text', { x: centro, y: altura - 8, 'text-anchor': 'middle' }, svg);
                t.textContent = d.rotulo;
            }

            // Alvo de interação: a banda inteira (maior que a marca)
            const alvo = criar('rect', {
                class: 'marca-alvo', x: centro - banda / 2, y: margem.topo, width: banda, height: plotA, tabindex: 0,
                'aria-label': `${d.titulo ?? d.rotulo}: ${series.map(s => `${s.nome} ${d.valores[s.chave] ?? 0}`).join(', ')}`,
            }, svg);
            const mostrar = () => {
                const escalaX = area.clientWidth / largura;
                dica.mostrar(d.titulo ?? d.rotulo, [
                    ...series.map(s => ({ cor: s.cor, nome: s.nome, valor: fmt.format(d.valores[s.chave] ?? 0) })),
                    { cor: '', nome: 'Total', valor: fmt.format(totais[i]) },
                ], centro * escalaX, y(totais[i]) * escalaX);
            };
            alvo.addEventListener('pointerenter', mostrar);
            alvo.addEventListener('focus', mostrar);
            alvo.addEventListener('pointerleave', dica.esconder);
            alvo.addEventListener('blur', dica.esconder);
        });
    };

    container._desligar = responsivo(area, desenhar);
    visaoTabela(container,
        ['Período', ...series.map(s => s.nome), 'Total'],
        dados.map((d, i) => [d.titulo ?? d.rotulo, ...series.map(s => d.valores[s.chave] ?? 0),
            series.reduce((soma, s) => soma + (d.valores[s.chave] ?? 0), 0)]));
}

// ── Barras horizontais empilhadas (comparação entre itens) ─────────────────

/**
 * @param dados [{ rotulo, valores: { chave: n }, aoClicar? }]
 */
export function barrasEmpilhadas(container, { dados, series, descricao = '', larguraRotulo = 200 }) {
    container._desligar?.();
    container.replaceChildren();
    container.append(legenda(series));

    const area = document.createElement('div');
    area.style.position = 'relative';
    container.append(area);
    const dica = criarDica(area);

    const desenhar = (largura) => {
        area.querySelector('svg')?.remove();
        const espessura = 16;
        const passoLinha = 30;
        const rotuloL = Math.min(larguraRotulo, largura * 0.38);
        const fimL = 44; // espaço para o total na ponta
        const plotL = largura - rotuloL - fimL;
        const altura = dados.length * passoLinha + 4;
        const totais = dados.map(d => series.reduce((s, sr) => s + (d.valores[sr.chave] ?? 0), 0));
        const maximo = Math.max(...totais, 1);
        const x = v => (v / maximo) * plotL;

        const svg = criar('svg', { viewBox: `0 0 ${largura} ${altura}`, role: 'img', 'aria-label': descricao });
        area.prepend(svg);
        criar('line', { class: 'eixo-linha', x1: rotuloL, x2: rotuloL, y1: 0, y2: altura }, svg);

        dados.forEach((d, i) => {
            const yCentro = i * passoLinha + passoLinha / 2;
            const grupo = criar('g', { class: 'grupo-barra' }, svg);

            const nome = criar('text', { x: rotuloL - 10, y: yCentro + 4, 'text-anchor': 'end' }, svg);
            const maxCaracteres = Math.floor(rotuloL / 6.6);
            nome.textContent = d.rotulo.length > maxCaracteres ? d.rotulo.slice(0, maxCaracteres - 1) + '…' : d.rotulo;
            nome.style.fill = 'var(--texto-2)';

            let base = 0;
            const visiveis = series.filter(s => (d.valores[s.chave] ?? 0) > 0);
            visiveis.forEach((s, n) => {
                const valor = d.valores[s.chave];
                const ehPonta = n === visiveis.length - 1;
                const largSeg = Math.max(x(valor) - (n > 0 ? 2 : 0), 1);
                criar('path', {
                    class: 'seg', fill: s.cor,
                    d: caminhoBarra(rotuloL + x(base) + (n > 0 ? 2 : 0), yCentro - espessura / 2, largSeg, espessura, ehPonta ? 4 : 0, 'ponta'),
                }, grupo);
                base += valor;
            });

            const total = criar('text', { x: rotuloL + x(totais[i]) + 6, y: yCentro + 4, class: 'rotulo-valor' }, svg);
            total.textContent = fmt.format(totais[i]);

            const alvo = criar('rect', {
                class: 'marca-alvo', x: 0, y: i * passoLinha, width: largura, height: passoLinha, tabindex: 0,
                'aria-label': `${d.rotulo}: ${series.map(s => `${s.nome} ${d.valores[s.chave] ?? 0}`).join(', ')}`,
            }, svg);
            if (d.aoClicar) {
                alvo.style.cursor = 'pointer';
                alvo.addEventListener('click', d.aoClicar);
                alvo.addEventListener('keydown', (e) => { if (e.key === 'Enter') d.aoClicar(); });
            }
            const mostrar = () => {
                const escalaX = area.clientWidth / largura;
                dica.mostrar(d.rotulo, [
                    ...series.map(s => ({ cor: s.cor, nome: s.nome, valor: fmt.format(d.valores[s.chave] ?? 0) })),
                    { cor: '', nome: 'Total', valor: fmt.format(totais[i]) },
                ], (rotuloL + x(totais[i]) / 2) * escalaX, (yCentro - espessura / 2) * escalaX);
            };
            alvo.addEventListener('pointerenter', mostrar);
            alvo.addEventListener('focus', mostrar);
            alvo.addEventListener('pointerleave', dica.esconder);
            alvo.addEventListener('blur', dica.esconder);
        });
    };

    container._desligar = responsivo(area, desenhar);
    visaoTabela(container,
        ['Item', ...series.map(s => s.nome), 'Total'],
        dados.map((d, i) => [d.rotulo, ...series.map(s => d.valores[s.chave] ?? 0),
            series.reduce((soma, s) => soma + (d.valores[s.chave] ?? 0), 0)]));
}

// ── Barra única por faixas (ordinal) ───────────────────────────────────────

/**
 * Uma barra 100% dividida em faixas ordenadas (ex.: idade dos itens abertos).
 * @param faixas [{ nome, valor, cor }]
 */
export function barraFaixas(container, { faixas, descricao = '' }) {
    container._desligar?.();
    container.replaceChildren();
    const total = faixas.reduce((s, f) => s + f.valor, 0);

    const area = document.createElement('div');
    area.style.position = 'relative';
    container.append(area);
    const dica = criarDica(area);

    const desenhar = (largura) => {
        area.querySelector('svg')?.remove();
        const altura = 20;
        const svg = criar('svg', { viewBox: `0 0 ${largura} ${altura}`, role: 'img', 'aria-label': descricao });
        area.prepend(svg);
        if (!total) {
            criar('rect', { x: 0, y: 4, width: largura, height: 12, rx: 4, fill: 'var(--superficie-2)' }, svg);
            return;
        }
        let x = 0;
        const visiveis = faixas.filter(f => f.valor > 0);
        visiveis.forEach((f, n) => {
            const l = (f.valor / total) * largura - (n < visiveis.length - 1 ? 2 : 0);
            const primeiro = n === 0;
            const ultimo = n === visiveis.length - 1;
            const r = Math.min(4, l / 2);
            // cantos arredondados só nas extremidades da barra
            const d = `M${x + (primeiro ? r : 0)},2H${x + l - (ultimo ? r : 0)}${ultimo ? `Q${x + l},2 ${x + l},${2 + r}V${18 - r}Q${x + l},18 ${x + l - r},18` : `V18`}H${x + (primeiro ? r : 0)}${primeiro ? `Q${x},18 ${x},${18 - r}V${2 + r}Q${x},2 ${x + r},2` : 'V2'}Z`;
            criar('path', { d, fill: f.cor, class: 'seg' }, svg);
            const alvo = criar('rect', { x, y: 0, width: Math.max(l, 6), height: altura, class: 'marca-alvo', tabindex: 0, 'aria-label': `${f.nome}: ${f.valor}` }, svg);
            const centro = x + l / 2;
            const mostrar = () => dica.mostrar(f.nome, [{ cor: f.cor, nome: `${Math.round((f.valor / total) * 100)}% dos abertos`, valor: fmt.format(f.valor) }],
                centro * (area.clientWidth / largura), 0);
            alvo.addEventListener('pointerenter', mostrar);
            alvo.addEventListener('focus', mostrar);
            alvo.addEventListener('pointerleave', dica.esconder);
            alvo.addEventListener('blur', dica.esconder);
            x += l + 2;
        });
    };

    container._desligar = responsivo(area, desenhar);

    // Legenda com os valores: identidade nunca só pela cor
    const ul = legenda(faixas.map(f => ({ ...f, rotuloLegenda: `${f.nome} · ${fmt.format(f.valor)}` })));
    ul.style.margin = '12px 0 0';
    container.append(ul);
}

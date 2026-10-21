import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool(process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL);

async function initDB(){
  await pool.query(`CREATE TABLE IF NOT EXISTS produtos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100), preco DECIMAL(10,2), estoque INT, validade DATE, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vendas (id INT AUTO_INCREMENT PRIMARY KEY, produto VARCHAR(100), valor DECIMAL(10,2), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  // tenta adicionar coluna validade se a tabela já existia
  try { await pool.query(`ALTER TABLE produtos ADD COLUMN validade DATE`); } catch(e){}
}
initDB().catch(e=>console.log(e));

function checkValidade(dataValidade){
  if(!dataValidade) return {status:'SEM VALIDADE', cor:'gray'};
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const val = new Date(dataValidade);
  const diff = Math.ceil((val - hoje)/(1000*60*60*24));
  if(diff < 0) return {status:'VENCIDO', cor:'red', diff};
  if(diff <= 3) return {status:`VENCE EM ${diff} DIAS`, cor:'orange', diff};
  return {status:'OK', cor:'green', diff};
}

app.get("/", (req,res)=>{
  res.send(`
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:sans-serif;padding:15px;background:#f8f7ff}.card{background:white;padding:15px;border-radius:12px;margin:10px 0}input{width:100%;padding:12px;margin:6px 0;border-radius:8px;border:1px solid #ddd}button{padding:12px;border:none;border-radius:8px;font-weight:bold;width:100%}</style></head>
  <body>
  <h1>🍭 Pirulilito - ONLINE!</h1><p><b>Sem taxa - COM VALIDADE</b></p>
  <div class="card"><h3>Novo Produto</h3>
  <input id="nome" placeholder="Nome"><input id="preco" type="number" step="0.01" placeholder="Preço"><input id="estoque" type="number" placeholder="Estoque"><label>Validade:</label><input id="validade" type="date"><button onclick="salvar()" style="background:#7c3aed;color:white">Salvar Produto</button></div>
  <div class="card"><h3>Nova Venda</h3><input id="v-produto" placeholder="Produto"><input id="v-valor" type="number" step="0.01" placeholder="Valor"><button onclick="vender()" style="background:#22c55e;color:white">Registrar Venda</button></div>
  <div class="card"><h3>Estoque</h3><div id="lista-estoque"></div></div>
  <div class="card" style="border:2px solid red"><h3>🔴 Vencidos - Prejuízo</h3><div id="lista-vencidos"></div><b id="prejuizo"></b></div>
  <div class="card"><h3>Vendas</h3><div id="lista-vendas"></div></div>
  <script>
  async function carregar(){
    const r=await fetch('/api/produtos'); const data=await r.json();
    let e='', v=''; let prej=0;
    data.forEach(p=>{
      const info = (()=>{ if(!p.validade) return {status:'SEM VALIDADE', cor:'gray'}; const hoje=new Date(); hoje.setHours(0,0,0,0); const val=new Date(p.validade); const diff=Math.ceil((val-hoje)/(1000*60*60*24)); if(diff<0) return {status:'VENCIDO',cor:'red'}; if(diff<=3) return {status:'VENCE EM '+diff+' DIAS',cor:'orange'}; return {status:'OK',cor:'green'}; })();
      const linha='<div style="border-left:5px solid '+info.cor+';margin:5px 0;padding:8px;background:#f9f9f9">'+p.nome+' - R$'+p.preco+' - est:'+p.estoque+' - Val:'+(p.validade?new Date(p.validade).toLocaleDateString():'-')+' - <b>'+info.status+'</b></div>';
      if(info.cor==='red'){v+=linha; prej+=parseFloat(p.preco)*p.estoque;} else {e+=linha;}
    });
    document.getElementById('lista-estoque').innerHTML=e||'Nenhum ok';
    document.getElementById('lista-vencidos').innerHTML=v||'Nenhum vencido 🎉';
    document.getElementById('prejuizo').innerText='Prejuízo: R$ '+prej.toFixed(2);
    const r2=await fetch('/api/vendas'); const vd=await r2.json();
    document.getElementById('lista-vendas').innerHTML=vd.map(x=>x.produto+' - R$'+x.valor).join('<br>')||'Sem vendas';
  }
  async function salvar(){await fetch('/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:document.getElementById('nome').value,preco:parseFloat(document.getElementById('preco').value),estoque:parseInt(document.getElementById('estoque').value),validade:document.getElementById('validade').value})});carregar();}
  async function vender(){const resp=await fetch('/api/vendas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produto:document.getElementById('v-produto').value,valor:parseFloat(document.getElementById('v-valor').value})});const j=await resp.json(); if(j.erro) alert(j.erro); carregar();}
  carregar();
  </script></body></html>`);
});

app.get("/api/produtos", async (req,res)=>{
  const [rows] = await pool.query("SELECT * FROM produtos ORDER BY validade ASC");
  res.json(rows);
});
app.post("/api/produtos", async (req,res)=>{
  const {nome, preco, estoque, validade} = req.body;
  await pool.query("INSERT INTO produtos (nome, preco, estoque, validade) VALUES (?,?,?,?)", [nome, preco, estoque, validade || null]);
  res.json({ok:true});
});
app.get("/api/vendas", async (req,res)=>{
  const [rows] = await pool.query("SELECT * FROM vendas ORDER BY id DESC");
  res.json(rows);
});
app.post("/api/vendas", async (req,res)=>{
  const {produto, valor} = req.body;
  const [rows] = await pool.query("SELECT * FROM produtos WHERE LOWER(nome)=LOWER(?) LIMIT 1", [produto]);
  if(rows.length>0){
    const p = rows[0];
    const check = checkValidade(p.validade);
    if(check.cor==='red') return res.json({erro:'⛔ PRODUTO VENCIDO! Não pode vender '+p.nome});
    if(p.estoque>0) await pool.query("UPDATE produtos SET estoque = estoque -1 WHERE id=?", [p.id]);
  }
  await pool.query("INSERT INTO vendas (produto, valor) VALUES (?,?)", [produto, valor]);
  res.json({ok:true});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('ok '+PORT));

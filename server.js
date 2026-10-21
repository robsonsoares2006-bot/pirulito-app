import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const pool = mysql.createPool(dbUrl);

async function initDB(){
  await pool.query("CREATE TABLE IF NOT EXISTS produtos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100), preco DECIMAL(10,2), estoque INT, validade DATE, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE TABLE IF NOT EXISTS vendas (id INT AUTO_INCREMENT PRIMARY KEY, produto VARCHAR(100), valor DECIMAL(10,2), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
}
initDB();

app.get("/", (req,res)=>{
  res.send(`
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;padding:15px;background:#f8f7ff}.card{background:white;padding:15px;border-radius:12px;margin:10px 0}input{width:100%;padding:12px;margin:6px 0;border-radius:8px;border:1px solid #ddd}button{padding:12px;border:none;border-radius:8px;font-weight:bold;width:100%}</style></head><body>
<h1>Pirulilito</h1>
<div class="card"><h3>Novo Produto</h3><input id="nome" placeholder="Nome"><input id="preco" type="number" step="0.01" placeholder="Preco"><input id="estoque" type="number" placeholder="Estoque"><input id="validade" type="date"><button onclick="salvar()" style="background:#7c3aed;color:white">Salvar</button><p id="msg"></p></div>
<div class="card"><h3>Nova Venda</h3><input id="v-produto" placeholder="Produto"><input id="v-valor" type="number" step="0.01" placeholder="Valor"><button onclick="vender()" style="background:#22c55e;color:white">Vender</button><p id="msgV"></p></div>
<div class="card"><h3>Estoque</h3><div id="lista-estoque"></div></div>
<div class="card" style="border:2px solid red"><h3>Vencidos - Prejuizo</h3><div id="lista-vencidos"></div><b id="prejuizo" style="color:red"></b></div>
<div class="card"><h3>Vendas</h3><div id="lista-vendas"></div></div>
<script>
async function carregar(){
  const r=await fetch('/api/produtos'); const data=await r.json();
  let e='', v=''; let prej=0;
  data.forEach(p=>{
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    let status='SEM VALIDADE', cor='gray', vencido=false;
    if(p.validade){
      const val=new Date(p.validade);
      const diff=Math.ceil((val-hoje)/86400000);
      if(diff<0){status='VENCIDO';cor='red';vencido=true;}
      else if(diff<=3){status='VENCE EM '+diff+' DIAS';cor='orange';}
      else{status='OK';cor='green';}
    }
    const btn=vencido?'<button onclick="deletar('+p.id+')" style="background:red;color:white;padding:6px;width:auto;margin-left:10px">Descartar</button>':'';
    const validadeTxt=p.validade?new Date(p.validade).toLocaleDateString('pt-BR'):'-';
    const linha='<div style="border-left:5px solid '+cor+';padding:8px;margin:6px 0;background:#f9f9f9;display:flex;justify-content:space-between"><span>'+p.nome+' - R$'+p.preco+' - est:'+p.estoque+' - Val:'+validadeTxt+' - <b>'+status+'</b></span>'+btn+'</div>';
    if(vencido){v+=linha; prej+=parseFloat(p.preco)*p.estoque;} else {e+=linha;}
  });
  document.getElementById('lista-estoque').innerHTML=e||'Nenhum';
  document.getElementById('lista-vencidos').innerHTML=v||'Nenhum vencido';
  document.getElementById('prejuizo').innerText=v?'Prejuizo: R$ '+prej.toFixed(2):'';
  const r2=await fetch('/api/vendas'); const vd=await r2.json();
  document.getElementById('lista-vendas').innerHTML=vd.map(x=>{
    let d=''; try{d=new Date(x.criado_em).toLocaleDateString('pt-BR')+' '+new Date(x.criado_em).toLocaleTimeString('pt-BR');}catch(e){}
    return '<div>'+x.produto+' - R$'+x.valor+' - '+d+'</div>';
  }).join('')||'Sem vendas';
}
async function salvar(){
  const payload={nome:document.getElementById('nome').value, preco:parseFloat(document.getElementById('preco').value), estoque:parseInt(document.getElementById('estoque').value), validade:document.getElementById('validade').value||null};
  const resp=await fetch('/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j=await resp.json(); if(!resp.ok||j.erro){alert(j.erro);return;} carregar();
}
async function vender(){
  const resp=await fetch('/api/vendas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produto:document.getElementById('v-produto').value, valor:parseFloat(document.getElementById('v-valor').value)})});
  const j=await resp.json(); if(!resp.ok||j.erro){alert(j.erro);return;} carregar();
}
async function deletar(id){ if(!confirm('Descartar vencido?')) return; await fetch('/api/produtos/'+id,{method:'DELETE'}); carregar(); }
carregar();
</script></body></html>
  `);
});

app.get("/api/produtos", async (req,res)=>{
  try{ const [rows]=await pool.query("SELECT * FROM produtos ORDER BY validade IS NULL, validade ASC"); res.json(rows); }catch(e){ res.status(500).json({erro:e.message}) }
});
app.post("/api/produtos", async (req,res)=>{
  try{ const {nome, preco, estoque, validade}=req.body; let v=validade && validade!=="" ? validade : null; await pool.query("INSERT INTO produtos (nome, preco, estoque, validade) VALUES (?,?,?,?)", [nome, preco, estoque, v]); res.json({ok:true}); }catch(e){ res.status(500).json({erro:e.message}) }
});
app.delete("/api/produtos/:id", async (req,res)=>{
  try{ await pool.query("DELETE FROM produtos WHERE id=?", [req.params.id]); res.json({ok:true}); }catch(e){ res.status(500).json({erro:e

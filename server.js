 import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
const app = express();
app.use(cors());
app.use(express.json());
const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const pool = mysql.createPool(dbUrl);

async function initDB(){
  await pool.query(`CREATE TABLE IF NOT EXISTS produtos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100), preco DECIMAL(10,2), estoque INT, validade DATE, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vendas (id INT AUTO_INCREMENT PRIMARY KEY, produto VARCHAR(100), valor DECIMAL(10,2), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  try{
    const [cols] = await pool.query(`SHOW COLUMNS FROM produtos LIKE 'validade'`);
    if(cols.length===0) await pool.query(`ALTER TABLE produtos ADD COLUMN validade DATE NULL`);
  }catch(e){console.log(e.message)}
}
initDB();

app.get("/", (req,res)=>{
  res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;padding:15px;background:#f8f7ff}.card{background:white;padding:15px;border-radius:12px;margin:10px 0;box-shadow:0 2px 8px #0001}input{width:100%;padding:12px;margin:6px 0;border-radius:8px;border:1px solid #ddd;box-sizing:border-box}button{padding:12px;border:none;border-radius:8px;font-weight:bold;width:100%;cursor:pointer}.btn-del{background:#ef4444;color:white;padding:6px 10px;width:auto;margin-left:8px;border-radius:6px;font-size:12px}</style></head><body>
<h1>🍭 Pirulilito - Controle Validade</h1>
<div class="card"><h3>Novo Produto</h3><input id="nome" placeholder="Nome"><input id="preco" type="number" step="0.01" placeholder="Preço"><input id="estoque" type="number" placeholder="Estoque"><label>Validade:</label><input id="validade" type="date"><button onclick="salvar()" style="background:#7c3aed;color:white">Salvar Produto</button><p id="msg" style="font-weight:bold"></p></div>
<div class="card"><h3>Nova Venda</h3><input id="v-produto" placeholder="Produto"><input id="v-valor" type="number" step="0.01" placeholder="Valor"><button onclick="vender()" style="background:#22c55e;color:white">Registrar Venda</button><p id="msgV"></p></div>
<div class="card"><h3>Estoque (Válidos)</h3><div id="lista-estoque">Carregando...</div></div>
<div class="card" style="border:2px solid #ef4444"><h3>🔴 Vencidos - Prejuízo</h3><div id="lista-vencidos"></div><b id="prejuizo" style="font-size:18px;color:red"></b></div>
<div class="card"><h3>Vendas</h3><div id="lista-vendas"></div></div>
<script>
async function carregar(){
  const r=await fetch('/api/produtos'); const data=await r.json();
  let e='', v=''; let prej=0;
  data.forEach(p=>{
    const hoje=new Date(); hoje.setHours(0,0,0,0); let status='SEM VALIDADE', cor='gray', vencido=false;
    if(p.validade){ const val=new Date(p.validade); const diff=Math.ceil((val-hoje)/(1000*60*60*24)); if(diff<0){ status='VENCIDO'; cor='red'; vencido=true; } else if(diff<=3){ status='VENCE EM '+diff+' DIAS'; cor='orange'; } else { status='OK'; cor='green'; } }
    const linha='<div style="border-left:5px solid '+cor+';margin:6px 0;padding:10px;background:#f9f9f9;display:flex;justify-content:space-between;align-items:center"><span>'+p.nome+' - R$'+p.preco+' - est:'+p.estoque+' - Val:'+(p.validade?new Date(p.validade).toLocaleDateString('pt-BR'):'-')+' - <b>'+status+'</b></span><span><button class=btn-del onclick="deletar('+p.id+',\\''+p.nome+'\\')">🗑️ Descartar</button></span></div>';
    if(vencido){ v+=linha; prej+=parseFloat(p.preco)*p.estoque; } else { e+=linha; }
  });
  document.getElementById('lista-estoque').innerHTML=e||'Nenhum produto válido 🎉';
  document.getElementById('lista-vencidos').innerHTML=v||'Nenhum vencido 🎉';
  document.getElementById('prejuizo').innerText=v ? 'Prejuízo total: R$ '+prej.toFixed(2) : '';
  const r2=await fetch('/api/vendas'); const vd=await r2.json();
  document.getElementById('lista-vendas').innerHTML=vd.map(x=>{ let d=''; try{ d=new Date(x.criado_em).toLocaleString('pt-BR'); }catch(e){} return '<div>'+x.produto+' - R$'+x.valor+' - '+d+'</div>'; }).join('')||'Sem vendas';
}
async function salvar(){
  const msg=document.getElementById('msg'); msg.innerText='Salvando...';
  const payload={nome:document.getElementById('nome').value, preco:parseFloat(document.getElementById('preco').value), estoque:parseInt(document.getElementById('estoque').value), validade:document.getElementById('validade').value || null};
  const resp=await fetch('/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const j=await resp.json();
  if(!resp.ok || j.erro){ msg.innerText='ERRO: '+j.erro; msg.style.color='red'; return; } msg.innerText='✅ Salvo!'; msg.style.color='green'; document.getElementById('nome').value=''; document.getElementById('preco').value=''; document.getElementById('estoque').value=''; document.getElementById('validade').value=''; carregar();
}
async function vender(){
  const msg=document.getElementById('msgV'); msg.innerText='Vendendo...';
  const resp=await fetch('/api/vendas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produto:document.getElementById('v-produto').value, valor:parseFloat(document.getElementById('v-valor').value)})}); const j=await resp.json();
  if(!resp.ok || j.erro){ msg.innerText='ERRO: '+j.erro; alert(j.erro); msg.style.color='red'; return; } msg.innerText='✅ Venda!'; carregar();
}
async function deletar(id, nome){
  if(!confirm('Descartar "'+nome+'" vencido? Isso remove do estoque e zera o prejuízo.')) return;
  await fetch('/api/produtos/'+id,{method:'DELETE'}); carregar();
}
carregar();
</script></body></html>`);
});
app.get("/api/produtos", async (req,res)=>{ try{ const [rows]=await pool.query("SELECT * FROM produtos ORDER BY validade IS NULL, validade ASC"); res.json(rows); }catch(e){ res.status(500).json({erro:e.message}) } });
app.post("/api/produtos", async (req,res)=>{ try{ const {nome, preco, estoque, validade}=req.body; let dataVal = validade && validade!=="" ? validade : null; await pool.query("INSERT INTO produtos (nome, preco, estoque, validade) VALUES (?,?,?,?)", [nome, preco, estoque, dataVal]); res.json({ok:true}); }catch(e){ res.status(500).json({erro:e.message}) } });
app.delete("/api/produtos/:id", async (req,res)=>{ try{ await pool.query("DELETE FROM produtos WHERE id=?", [req.params.id]); res.json({ok:true}); }catch(e){ res.status(500).json({erro:e.message}) } });
app.get("/api/vendas", async (req,res)=>{ try{ const [rows]=await pool.query("SELECT * FROM vendas ORDER BY id DESC"); res.json(rows); }catch(e){ res.status(500).json({erro:e.message}) } });
app.post("/api/vendas", async (req,res)=>{ try{ const {produto, valor}=req.body; const [rows]=await pool.query("SELECT * FROM produtos WHERE LOWER(TRIM(nome))=LOWER(TRIM(?)) LIMIT 1", [produto]); if(rows.length>0){ const p=rows[0]; if(p.validade){ const hoje=new Date(); hoje.setHours(0,0,0,0); const val=new Date(p.validade); if(val < hoje) return res.status(400).json({erro:'⛔ BLOQUEADO: '+p.nome+' VENCIDO em '+new Date(p.validade).toLocaleDateString('pt-BR')}); } if(p.estoque>0) await pool.query("UPDATE produtos SET estoque=estoque-1 WHERE id=?", [p.id]); } await pool.query("INSERT INTO vendas (produto, valor) VALUES (?,?)", [produto, valor]); res.json({ok:true}); }catch(e){ res.status(500).json({erro:e.message}) } });
app.listen(process.env.PORT||3000, ()=>console.log('ok'));

import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
const app = express();
app.use(cors());
app.use(express.json());
const pool = mysql.createPool(process.env.MYSQL_URL || process.env.DATABASE_URL);
async function initDB(){
  await pool.query(`CREATE TABLE IF NOT EXISTS produtos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(255), preco DECIMAL(10,2), estoque INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS clientes (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(255), telefone VARCHAR(50))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vendas (id INT AUTO_INCREMENT PRIMARY KEY, produto VARCHAR(255), valor DECIMAL(10,2), data TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
}
initDB().catch(e=>console.log(e));
app.get("/api/produtos", async (req,res)=>{
  const [rows] = await pool.query("SELECT * FROM produtos");
  res.json(rows);
});
app.post("/api/produtos", async (req,res)=>{
  const {nome, preco, estoque} = req.body;
  await pool.query("INSERT INTO produtos (nome,preco,estoque) VALUES (?,?,?)", [nome, preco, estoque]);
  res.json({ok:true});
});
app.get("/api/vendas", async (req,res)=>{
  const [rows] = await pool.query("SELECT * FROM vendas ORDER BY id DESC");
  res.json(rows);
});
app.post("/api/vendas", async (req,res)=>{
  const {produto, valor} = req.body;
  await pool.query("INSERT INTO vendas (produto,valor) VALUES (?,?)", [produto, valor]);
  res.json({ok:true});
});
app.get("/", (req,res)=>{
  res.send(`<html><head><meta name="viewport" content="width=device-width"><title>Pirulilito</title><style>body{font-family:sans-serif;padding:20px;background:#f5f0ff} .card{background:white;padding:15px;border-radius:12px;margin:10px 0} button{background:#7c3aed;color:white;border:0;padding:10px 15px;border-radius:8px;width:100%} input{padding:10px;border-radius:8px;border:1px solid #ddd;width:100%;margin:5px 0;box-sizing:border-box}</style></head><body><h1>🍭 Pirulilito - ONLINE!</h1><p>Sem taxa de maquininha</p><div class="card"><h3>Novo Produto</h3><input id="pn" placeholder="Nome"><input id="pp" placeholder="Preco" type="number"><input id="pe" placeholder="Estoque" type="number"><button onclick="addProd()">Salvar Produto</button></div><div class="card"><h3>Nova Venda</h3><input id="vp" placeholder="Produto"><input id="vv" placeholder="Valor" type="number"><button onclick="addVenda()">Registrar Venda</button></div><div class="card"><h3>Estoque</h3><div id="lista">carregando...</div></div><div class="card"><h3>Vendas</h3><div id="vendas">carregando...</div></div><script>async function load(){let r=await fetch('/api/produtos');let d=await r.json();document.getElementById('lista').innerHTML=d.map(p=>p.nome+' - R$'+p.preco+' - estoque:'+p.estoque).join('<br>');let r2=await fetch('/api/vendas');let d2=await r2.json();document.getElementById('vendas').innerHTML=d2.map(v=>v.produto+' - R$'+v.valor).join('<br>');}async function addProd(){await fetch('/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:pn.value,preco:pp.value,estoque:pe.value})});load();}async function addVenda(){await fetch('/api/vendas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produto:vp.value,valor:vv.value})});load();}load();</script></body></html>`);
});
app.listen(process.env.PORT || 3000, ()=>console.log("Pirulilito ON"));

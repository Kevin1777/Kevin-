// 基础交互脚本
function toggleMenu(){
  const nav = document.getElementById('nav-list');
  const btn = document.querySelector('.menu-btn');
  const open = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function handleSubmit(e){
  e.preventDefault();
  const status = document.getElementById('form-status');
  status.textContent = '已收到（示例表单，未接入后端）。';
  e.target.reset();
  return false;
}

document.addEventListener('DOMContentLoaded', ()=> {
  document.getElementById('year').textContent = new Date().getFullYear();
});

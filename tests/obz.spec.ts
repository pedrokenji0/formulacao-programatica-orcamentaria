import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
const description='Item sintético — importação sem sobrescrita';
async function openObz(page:Page){
  await page.goto('./'); await expect(page.getByLabel('Programa ativo',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('button',{name:'1.2 ORÇAMENTO BASE ZERO',exact:true}).click();
  await page.getByRole('button',{name:'Itens OBZ e Classificação',exact:true}).click();
}
function workbook(exercise:unknown='2026'){
 const rows=[['UO','PROGRAMA','AÇÃO','DESCRIÇÃO DO ITEM','VOLUME','PREÇO UNITÁRIO','FREQUÊNCIA','VALOR TOTAL ITEM','CLASSIFICAÇÃO CENÁRIO','EXERCÍCIO'],
 ['01221 - SEDE','0125 - Programa','1082 - Ação',description,2,30,12,0,'LIMIAR',exercise]];
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'BASE OBZ');
 return XLSX.write(book,{type:'buffer',bookType:'xlsx'});
}
async function upload(page:Page,buffer:Buffer,name='obz-2027.xlsx'){
 await page.locator('input[type=file]').setInputFiles({name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
}
test('importa sem duplicar e mantém total declarado ao editar a memória de cálculo',async({page})=>{
 await openObz(page);
 await expect(page.getByLabel('Escopo da base OBZ')).toHaveValue('pendentes');
 await page.getByRole('button',{name:'Importar planilha',exact:true}).click();
 const buffer=workbook();await upload(page,buffer);
 await expect(page.getByText('1 itens válidos',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar importação',exact:true}).click();
 await page.getByRole('button',{name:'Itens OBZ',exact:true}).click();
 await page.getByLabel('Escopo da base OBZ').selectOption('programa');
 await expect(page.getByRole('button',{name:'Abrir item '+description,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Abrir item '+description,exact:true}).click();
 await expect(page.getByLabel('Valor total informado',{exact:true})).toHaveValue('0');
 await page.getByLabel('Volume',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
 await page.getByRole('button',{name:'Abrir item '+description,exact:true}).click();
 await expect(page.getByLabel('Volume',{exact:true})).toHaveValue('3');
 await expect(page.getByLabel('Valor total informado',{exact:true})).toHaveValue('0');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Importar planilha',exact:true}).click();await upload(page,buffer);
 await expect(page.getByRole('button',{name:'Confirmar importação',exact:true})).toBeDisabled();
 await expect(page.getByText('1 já importados.',{exact:false})).toBeVisible();
});
test('nome do arquivo não vira exercício e itens sem vínculo ficam consultáveis',async({page})=>{
 await openObz(page);await page.getByRole('button',{name:'Importar planilha',exact:true}).click();await upload(page,workbook(''));
 await expect(page.getByText('0 com vínculo confirmado',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar importação',exact:true}).click();
 await page.getByRole('button',{name:'Itens OBZ',exact:true}).click();
 await page.getByLabel('Escopo da base OBZ').selectOption('pendentes');await page.getByLabel('Pesquisar itens OBZ',{exact:true}).fill(description);
 await page.getByRole('button',{name:'Abrir item '+description,exact:true}).click();
 await expect(page.getByLabel('Exercício do item OBZ',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.locator('.profile-sel select').selectOption('Leitor');
 await page.getByRole('button',{name:'Abrir item '+description,exact:true}).click();
 await expect(page.getByLabel('Descrição do item',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Salvar rascunho',exact:true})).toBeDisabled();
});
test('base Saúde é paginada e mantém origem fora do programa selecionado',async({page})=>{
 await openObz(page);
 await expect(page.getByLabel('Escopo da base OBZ')).toHaveValue('pendentes');
 await expect(page.locator('.data-table tbody tr')).toHaveCount(25);
 await expect(page.locator('.data-table-pagination')).toContainText('1502 registros');
 await page.getByRole('button',{name:'Próxima',exact:true}).click();
 await expect(page.locator('.data-table-pagination')).toContainText('página 2');
});

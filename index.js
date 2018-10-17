// O intuito inicial foi salvar os dados do arquivo CSV em uma matriz, organizar os dados limpando
// células incorretas e desorganizadas para assim criar os objetos JSON e 
// depois armazená-los no arquivo output.json. Tive problemas na conversão das colunas 'see_all'
// e 'invisible' portanto elas não foram incluídas na solução final.
// Continua funcionando ao rearranjar as colunas do arquivo CSV, desde que as colunas fullname e eid continuem sendo as primeiras.


const fs = require('fs');
let table = [];
var _ = require('lodash');

function createJsonObject (table, eid){ // cria um objeto JSON de um determinado elemento da matriz a partir de seu ID, assim recuperando todos os dados daquele elemento
                                        // caso ele tenha cadastros duplicados
                                        
    var getName = function(table, eid){ // busca o nome da pessoa cadastrada pelo ID, assim recuperando o nome apenas uma vez caso existam cadastros duplicados
        var sameId = false;
        for(rowIndex = 1; rowIndex < table.length; rowIndex++){
            for(columnIndex = 0; columnIndex < table[rowIndex].length; columnIndex++){
                if(!sameId && table[rowIndex][columnIndex].includes(eid)){
                    columnIndex = 0;
                    sameId = true;
                }
                if(sameId && table[0][columnIndex].includes('fullname'))
                    return table[rowIndex][columnIndex];
            }
            
            sameId = false;
        }
    };
    
    var getExternalId = function(eid){
        return eid.toString();
    };
    
    var getClasses = function(table, eid){  // pelo ID, busca as salas que estão constadas no cadastro da pessoa, independente do número de cadastros.
        var classes = [];
        var sameId = false;
        
        for(rowIndex = 1; rowIndex < table.length; rowIndex++){
            for(columnIndex = 0; columnIndex < table[rowIndex].length; columnIndex++){
                if(!sameId && table[rowIndex][columnIndex].includes(eid)){
                    columnIndex = 0;
                    sameId = true;
                }
                if(sameId && table[0][columnIndex].includes('class')){
                    classes = classes.concat(table[rowIndex][columnIndex]);
                }
            }
            
            sameId = false;
        }
        
        _.remove(classes, function(empty){
            return empty === '<empty>';
        });
        
        return classes;
    };
    
    var getAddresses = function(table, eid){    // recupera os 'addresses' relacionados à pessoa pelo ID, de quaisquer que sejam os tipos (email, telefone, etc)
        var addresses = [];
        
        function getAddressType (table, addressColumnIndex){    //recupera o tipo do 'address' pelo index da coluna na matriz criada a partir do arquivo CSV
           var type = table[0][addressColumnIndex].match(/[A-Za-záéíóúã]+/)[0];
           
           return type;
        };
        
        function getAddressTags (table, addressColumnIndex){    //recupera as tags do 'address' pelo index da coluna na matriz criada a partir do arquivo CSV
            var tags = table[0][addressColumnIndex].match(/[A-Za-záéíóúã]+/g);
            tags.shift();
            
            return tags;
        };
        
        var getAddressValue = function(table, rowIndex, addressColumnIndex, addressValueIndex){ //recupera os valores do 'address' pelo número da coluna na matriz criada a partir do arquivo CSV
            var addressValue = table[rowIndex][addressColumnIndex][addressValueIndex];          //já que podem existir mais de 1 valor em uma mesma célula da tabela, é usado o index do valor
                                                                                                //desejado a ser recuperado
            return addressValue;
        };
        
        var getAddressCellValuesQuantity = function(table, rowIndex, addressColumnIndex){       //recupera o número de valores em uma célula de uma coluna 'address' para ser usado
            return table[rowIndex][addressColumnIndex].length;                                  //na hora de recuperar os valores de um 'address'
        };
        
        var createSingleAddress = function(table, rowIndex, addressColumnIndex, addressValueIndex){ //cria um address a partir do tipo, tags e valores de uma celula de uma coluna 'address'
            var address = {
                'type' : getAddressType(table, addressColumnIndex),
                'tags' : getAddressTags(table, addressColumnIndex),
                'address' : getAddressValue(table, rowIndex, addressColumnIndex, addressValueIndex)
            };
            
            return address;
        };
        
        var isEmpty = function(table, rowIndex, addressColumnIndex){       //verifica se uma célula está vazia
            if(table[rowIndex][addressColumnIndex] === '<empty>')
                return true;
            
            return false;
        };
        
        var createAddresses = function(table, eid){         //cria os diversos 'addresses' que uma pessoa pode ter relacionada a ela. usa-se como parâmetro o id da pessoa
            var sameId = false;                             //para que sejam buscados todos os dados relacionados à pessoa, caso existam cadastros duplicados.
            
            for(rowIndex = 1; rowIndex < table.length; rowIndex++){
                for(columnIndex = 0; columnIndex < table[rowIndex].length; columnIndex++){
                    if(!sameId && table[rowIndex][columnIndex].includes(eid)){
                        columnIndex = 0;
                        sameId = true;
                    }
                    if(sameId && !(table[0][columnIndex].includes('fullname') || table[0][columnIndex].includes('eid') || table[0][columnIndex].includes('class') || table[0][columnIndex].includes('invisible')|| table[0][columnIndex].includes('see_all'))){
                        if(!isEmpty(table,rowIndex, columnIndex)){
                            var addressCellValuesQuantity = getAddressCellValuesQuantity(table, rowIndex, columnIndex);

                            for(addressValueIndex = 0; addressValueIndex < addressCellValuesQuantity; addressValueIndex++){
                                addresses.push(createSingleAddress(table, rowIndex, columnIndex, addressValueIndex));
                            }
                        }
                    }
                }
                
                sameId = false;
            }
        };
        
        createAddresses(table, eid);
        
        return addresses;
    };
    
    
    var person = {      //objeto json da pessoa
            'fullname' : getName(table, eid),
            'eid' : getExternalId(eid),
            'classes' : getClasses(table, eid),
            'addresses' : getAddresses(table, eid)
    };

    return person;
}

function replaceEmptyCells (row){       // algumas células do arquivo CSV estão vazias, o que pode trazer problemas na conversão para matriz, essa função
    var rowContent = row.toString();    // atribui um valor identificador para que seja possível saber quais células estão vazias
    
    rowContent = rowContent.replace(/,,/g, ",<empty>,");    // realiza o replace duas vezes pois nem todas as células são consertadas com apenas um replace
    rowContent = rowContent.replace(/,,/g, ",<empty>,");    // (não é gambiarra)
    
    return rowContent;
}

function createRow(array, rowIndex){ // cria as linhas da tabela, usando 'vírgula' como separador para criar os elementos
	let row = [];
	row = array[rowIndex].match(/(".*?"|[^\s",][^",]+[^\s",])(?=\s*,|\s*$)/g);
        
	return row;
}

function fixColumn(table, columnIndex){ // organiza dados de uma coluna e/ou remove entradas inapropriadas 
	let columnType = undefined;
        var regex;
	
	// não foram incluídos todos os tipos de colunas já que não foi necessária a organização de colunas como
	// name, eid, etc
	
	if (table[0][columnIndex].includes('class'))
		columnType = 'class';

	else if(table[0][columnIndex].includes('email'))
		columnType = 'email';

	else if(table[0][columnIndex].includes('phone'))
		columnType = 'phone';

	else if(table[0][columnIndex].includes('invisible'))
		columnType = 'invisible';

	else if(table[0][columnIndex].includes('see_all'))
		columnType = 'class';
		
	switch (columnType) {
		case ('class'): {
                    regex = /Sala+\s+\d/g;
                    break;
		}
		case ('email'): {       
                    regex = /\w+@[a-zA-Z]+\.com/g;
                    break;
		}
		case ('phone'): {
                    regex = /\(\d\d\)+\s+\d{7,11}|\d\d+\s+\d{8,11}/g;
                    break;
		}
		/*case ('invisible'): {
                    
                    break;
		}
		case ('see_all'): {
                   
                    break;
		}*/
			
	}
        
        for(row = 1; row < table.length; row++){
            table[row][columnIndex] = table[row][columnIndex].match(regex);
            
            if(table[row][columnIndex] === null)
                table[row][columnIndex] = '<empty>'; 
	}
}

fs.readFile('input.csv', (err, data) => {
	if(err) 
		console.log(err);
	else{
		const csvData = data.toString().split('\n');
                
		for(i = 0; i < csvData.length; i++){   //criando a tabela a partir dos dados do  arquivo CSV
                    csvData[i] = replaceEmptyCells(csvData[i]);
                    table.push(createRow(csvData, i));
                }
                
                fixColumn(table, 2);
                fixColumn(table, 3);        //consertando os dados inapropriados (carinhas, textos em       
                fixColumn(table, 4);        //campos de telefone, etc) da tabela que vieram do arquivo CSV
                fixColumn(table, 5);
                fixColumn(table, 6);
                fixColumn(table, 7);
                fixColumn(table, 8);
                fixColumn(table, 9);
                
                var output = [];     //lista que receberá os objetos JSON criados a partir dos dados das pessoas
                var eidList = [];    //lista que arquivará os IDs únicos dos cadastros 
                
                for(rowIndex = 1; rowIndex < table.length; rowIndex++){
                    for(columnIndex = 0; columnIndex < table[rowIndex].length; columnIndex++){
                        if(table[0][columnIndex].includes('eid') && !eidList.includes(table[rowIndex][columnIndex])){
                                eidList.push(table[rowIndex][columnIndex]); //salvando os IDs únicos
                        }
                    }
                }
                
                for(eidListIndex = 0; eidListIndex < eidList.length; eidListIndex++){
                    output.push(JSON.stringify(createJsonObject(table, eidList[eidListIndex])));    //criando os objetos JSON
                }
                
                fs.writeFileSync('output.json', output); //armazenando os objetos JSON no arquivo 'output.json'
	}
});

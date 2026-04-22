const mockProducts = [
    {
        id: '1',
        name: 'Liquid VitaD3 600 IU, Витамин D3 600 МЕ (жидкий), 30 мл',
        price: 1490,
        image: 'assets/images/products/product-01.png',
        points: 5,
        isHit: true,
        isAction: true,
        isNew: true,
        hasGift: true,
        category: 'vitamins',
        url: '/product/1'
    },
    {
        id: '2',
        name: 'MagniBalance B6, Магний \n' +
            'с витамином В6, 90 капсул',
        price: 534,
        image: 'assets/images/products/product-02.png',
        points: 15,
        isHit: true,
        isAction: false,
        isNew: false,
        hasGift: false,
        category: 'protein',
        url: '/product/2'
    },
    {
        id: '3',
        name: 'Choco Pure Multi Protein, 500 г',
        price: 2800,
        image: 'assets/images/products/product-03.png',
        points: 8,
        isHit: false,
        isAction: false,
        isNew: false,
        hasGift: false,
        category: 'nutraceuticals',
        url: '/product/3'
    },
    {
        id: '4',
        name: 'CitraBoost C900, Витамин С (Аскорбат Натрия) 900 с цитрусовыми...',
        price: 1290,
        image: 'assets/images/products/product-04.png',
        points: 6,
        isHit: true,
        isAction: true,
        isNew: false,
        hasGift: true,
        category: 'nutraceuticals',
        url: '/product/4'
    },
    {
        id: '5',
        name: 'Banan Pure Multi Protein, 500 г',
        price: 5990,
        image: 'assets/images/products/product-05.png',
        points: 25,
        isHit: true,
        isAction: false,
        isNew: false,
        hasGift: true,
        category: 'sets',
        url: '/product/5'
    },
    {
        id: '6',
        name: 'Vanilla Pure Multi Protein, 500 г',
        price: 590,
        image: 'assets/images/products/product-06.png',
        points: 2,
        isHit: false,
        isAction: false,
        isNew: true,
        hasGift: false,
        category: 'accessories',
        url: '/product/6'
    }
];

const MockAPI = {
    users: [
        {
            phone: '+79991234567',
            email: 'ivan@example.com',
            name: 'Иван Петров',
            registered: true
        }
    ],

    verificationCodes: {
        '+79991234567': '1234',
        'ivan@example.com': '1234',
    },
};

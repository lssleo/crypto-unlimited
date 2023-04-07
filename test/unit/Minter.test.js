const { assert, expect } = require('chai')
const { ethers } = require('hardhat')

const { AddressZero } = ethers.constants
const URI = 'http://uri'
const BASICNFTURI = 'BasicNftUri'
const RARENFTURI = 'RareNftUri'
const SUPERRARENFTURI = 'SuperRareNftUri'
const SALESSBTURI = 'SalesSbtUri'
const RARESBTURI = 'RareSbtUri'
const SUPERSBTURI = 'SuperSecretSbtUri'
const REGISTRY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('REGISTRY_ROLE'))
const MARKETPLACE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MARKETPLACE_ROLE'))
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'))
const SOULBOUNDS_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SOULBOUNDS_ROLE'))
const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20))
const minterPrice = ethers.utils.parseEther('0.1')
const nftPrice = ethers.utils.parseEther('0.5')

let accounts,
    owner,
    registryRole,
    marketplaceRole,
    minterRole,
    sbtRole,
    anyone,
    user1,
    user2,
    control,
    registry,
    marketplace,
    minter,
    soulbounds,
    holder,
    random,
    VRFMock

describe('Minter', async () => {
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        owner = accounts[0]
        registryRole = accounts[1]
        marketplaceRole = accounts[2]
        minterRole = accounts[3]
        sbtRole = accounts[4]
        anyone = accounts[5]
        user1 = accounts[6]
        user2 = accounts[7]

        ControlContract = await ethers.getContractFactory('Control')
        control = await ControlContract.deploy(
            registryRole.address,
            marketplaceRole.address,
            minterRole.address,
            sbtRole.address
        )
        await control.deployed()

        const RegistryContract = await ethers.getContractFactory('Registry')
        registry = await RegistryContract.deploy()
        await registry.deployed()

        const MarketplaceContract = await ethers.getContractFactory('Marketplace')
        marketplace = await MarketplaceContract.deploy(control.address, registry.address)
        await marketplace.deployed()

        const MinterContract = await ethers.getContractFactory('Minter')
        minter = await MinterContract.deploy(control.address, registry.address)
        await minter.deployed()

        const SoulboundsContract = await ethers.getContractFactory('Soulbounds')
        soulbounds = await SoulboundsContract.deploy(
            control.address,
            registry.address,
            SALESSBTURI,
            RARESBTURI,
            SUPERSBTURI
        )
        await soulbounds.deployed()

        const HolderContract = await ethers.getContractFactory('Holder')
        holder = await HolderContract.deploy([owner.address], ['100'])
        await holder.deployed()

        const VRFCoordinatorMock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
        VRFMock = await VRFCoordinatorMock.deploy('100000000000000000', '1000000000')
        await VRFMock.createSubscription()
        await VRFMock.fundSubscription('1', ethers.utils.parseEther('1'))

        RandomContract = await ethers.getContractFactory('Random')
        random = await RandomContract.deploy(registry.address, VRFMock.address, [
            BASICNFTURI,
            RARENFTURI,
            SUPERRARENFTURI,
        ])
        await random.deployed()

        await VRFMock.addConsumer('1', random.address)

        await control.connect(registryRole).setRegistry(registry.address)
        await registry.setMinterContract(minter.address)
        await registry.setMarketplaceContract(marketplace.address)
        await registry.setRandomContract(random.address)
        await registry.setSoulboundsContract(soulbounds.address)
        await registry.setHolderAddress(holder.address)
        await registry.setOracleParams(
            '1',
            '0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f',
            '500000'
        )
        // await control.connect(minterRole).setPriceMinter(minterPrice)
        // await control.connect(minterRole).activateMinter()
    })

    it('Reverts if request price is zero or status not active', async () => {
        await expect(minter.requestItem()).to.be.revertedWith('Minter: Generation not active')
        await control.connect(minterRole).activateMinter()
        await expect(minter.requestItem()).to.be.revertedWith('Minter: Generation not active')
        await control.connect(minterRole).disableMinter()
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await expect(minter.requestItem()).to.be.revertedWith('Minter: Generation not active')
    })
    it('Request fo free if address whitelisted and then removes from whitelist and reverts if send value', async () => {
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
        await control.connect(minterRole).setWhitelistMinter([owner.address])
        assert.equal(await random.isWhitelisted(owner.address), true)
        await expect(minter.requestItem({ value: minterPrice })).to.be.revertedWith(
            'Minter: Free mint from whitelist'
        )
        expect(await minter.requestItem()).to.emit('ItemRequested')
        assert.equal(await random.isWhitelisted(owner.address), false)
    })
    it('If minter currency in ERC20 it accept tokens and transfer to holder, emits event', async () => {
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
        const ERC20Contract = await ethers.getContractFactory('Token')
        token = await ERC20Contract.deploy()
        await token.mint(owner.address, minterPrice)
        await control.connect(minterRole).setCurrencyMinter(token.address)
        await token.approve(minter.address, minterPrice)

        expect(await minter.requestItem()).to.emit('ItemRequested')

        assert.equal(Number(await token.balanceOf(owner.address)).toString(), '0')
        assert.equal(Number(await token.balanceOf(holder.address)).toString(), minterPrice)
    })
    it('If price in native currency it transfers it to holder, emits event and reverts if price not met', async () => {
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
        await expect(minter.requestItem()).to.be.revertedWith('Minter: Price not met')
        expect(await minter.requestItem({ value: minterPrice })).to.emit('ItemRequested')
        assert.equal(
            Number(await ethers.provider.getBalance(holder.address)).toString(),
            minterPrice.toString()
        )
    })
    it('Reverts if not control contract try set new minter price', async () => {
        await expect(minter.connect(owner).setPrice('1')).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(marketplaceRole).setPrice('1')).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(minterRole).setPrice('1')).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(registryRole).setPrice('1')).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
    })
    it('Reverts if control contract try set minter price to zero or the same', async () => {
        await expect(control.connect(minterRole).setPriceMinter('0')).to.be.revertedWith(
            'Minter: Price cant be zero'
        )
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await expect(control.connect(minterRole).setPriceMinter(minterPrice)).to.be.revertedWith(
            'Minter: Price the same'
        )
    })
    it('Reverts if not control contract try set new minter currency', async () => {
        const ERC20Contract = await ethers.getContractFactory('Token')
        token = await ERC20Contract.deploy()
        await expect(minter.connect(owner).setCurrency(token.address)).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(marketplaceRole).setCurrency(token.address)).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(minterRole).setCurrency(token.address)).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(registryRole).setCurrency(token.address)).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
    })
    it('Reverts if control contract try set minter currency to the same', async () => {
        const ERC20Contract = await ethers.getContractFactory('Token')
        token = await ERC20Contract.deploy()
        await control.connect(minterRole).setCurrencyMinter(token.address)
        await expect(
            control.connect(minterRole).setCurrencyMinter(token.address)
        ).to.be.revertedWith('Minter: Currency the same')
    })

    it('Reverts if not control contract try set whitelist', async () => {
        await expect(minter.connect(owner).setWhitelist([anyone.address])).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(
            minter.connect(marketplaceRole).setWhitelist([anyone.address])
        ).to.be.revertedWith('Minter: Caller is not control contract')
        await expect(minter.connect(minterRole).setWhitelist([anyone.address])).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(
            minter.connect(registryRole).setWhitelist([anyone.address])
        ).to.be.revertedWith('Minter: Caller is not control contract')
    })
    it('Reverts if not control contract try disable minting', async () => {
        await expect(minter.connect(owner).disableGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(marketplaceRole).disableGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(minterRole).disableGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(registryRole).disableGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
    })
    it('Reverts if not control contract try activate minting', async () => {
        await expect(minter.connect(owner).activateGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(marketplaceRole).activateGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(minterRole).activateGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
        await expect(minter.connect(registryRole).activateGeneration()).to.be.revertedWith(
            'Minter: Caller is not control contract'
        )
    })

    it('Reverts if try disable minter when it not active', async () => {
        await expect(control.connect(minterRole).disableMinter()).to.be.revertedWith(
            'Minter: Generation not active'
        )
    })
    it('Reverts if try activate minter when it active', async () => {
        await control.connect(minterRole).activateMinter()
        await expect(control.connect(minterRole).activateMinter()).to.be.revertedWith(
            'Minter: Generation already active'
        )
    })
})

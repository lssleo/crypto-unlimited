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

describe('Holder', async () => {
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
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
    })

    it('Holder correct receive and realease money', async () => {
        await minter.requestItem({ value: minterPrice })
        assert.equal(
            Number(await ethers.provider.getBalance(holder.address)).toString(),
            minterPrice.toString()
        )
        await VRFMock.fulfillRandomWords('1', random.address)
        const ownerBalanceBefore = await owner.getBalance()
        const tx = await holder['release(address)'](owner.address)
        await tx.wait()
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
        const gasCost = Number(receipt.gasUsed.mul(tx.gasPrice))
        const ownerBalanceAfter = await owner.getBalance()
        assert.equal(
            (Number(ownerBalanceBefore) + Number(minterPrice)).toString(),
            (Number(ownerBalanceAfter) + Number(gasCost)).toString()
        )
    })
    it('Holder correct receive and realease ERC20 tokens', async () => {
        const ERC20Contract = await ethers.getContractFactory('Token')
        token = await ERC20Contract.deploy()
        await token.mint(owner.address, minterPrice)
        await control.connect(minterRole).setCurrencyMinter(token.address)
        await token.approve(minter.address, minterPrice)

        await minter.requestItem()

        assert.equal(Number(await token.balanceOf(owner.address)).toString(), '0')
        assert.equal(Number(await token.balanceOf(holder.address)).toString(), minterPrice)

        await holder['release(address,address)'](token.address, owner.address)

        assert.equal(Number(await token.balanceOf(owner.address)).toString(), minterPrice)
        assert.equal(Number(await token.balanceOf(holder.address)).toString(), '0')
    })

    it('Reverts if try release to address with zero shares', async () => {
        const ERC20Contract = await ethers.getContractFactory('Token')
        token = await ERC20Contract.deploy()
        await token.mint(owner.address, minterPrice)
        await control.connect(minterRole).setCurrencyMinter(token.address)
        await token.approve(minter.address, minterPrice)

        await minter.requestItem()

        await expect(holder.connect(anyone)['release(address)'](anyone.address)).to.be.revertedWith(
            'PaymentSplitter: account has no shares'
        )
        await expect(
            holder.connect(marketplaceRole)['release(address)'](anyone.address)
        ).to.be.revertedWith('PaymentSplitter: account has no shares')
        await expect(
            holder.connect(minterRole)['release(address)'](anyone.address)
        ).to.be.revertedWith('PaymentSplitter: account has no shares')
        await expect(
            holder.connect(sbtRole)['release(address)'](anyone.address)
        ).to.be.revertedWith('PaymentSplitter: account has no shares')
    })
})

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

describe('Registry', async () => {
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

    it('All addresses sets correct', async () => {
        assert.equal(await registry.getMinterAddress(), minter.address)
        assert.equal(await registry.getMarketplaceAddress(), marketplace.address)
        assert.equal(await registry.getRandomAddress(), random.address)
        assert.equal(await registry.getSoulboundsAddress(), soulbounds.address)
        assert.equal(await registry.getHolderAddress(), holder.address)
        assert.equal(await registry.getOwner(), owner.address)
    })

    it('Reverts if not owner try set minter contract', async () => {
        await expect(registry.connect(anyone).setMinterContract(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(minterRole).setMinterContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(registry.connect(sbtRole).setMinterContract(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(marketplaceRole).setMinterContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if not owner try set marketplace contract', async () => {
        await expect(
            registry.connect(anyone).setMarketplaceContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(minterRole).setMarketplaceContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(sbtRole).setMarketplaceContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(marketplaceRole).setMarketplaceContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if not owner try set random contract', async () => {
        await expect(registry.connect(anyone).setRandomContract(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(minterRole).setRandomContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(registry.connect(sbtRole).setRandomContract(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(marketplaceRole).setRandomContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if not owner try set soulbounds contract', async () => {
        await expect(
            registry.connect(anyone).setSoulboundsContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(minterRole).setSoulboundsContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(sbtRole).setSoulboundsContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(marketplaceRole).setSoulboundsContract(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if not owner try set holder contract', async () => {
        await expect(registry.connect(anyone).setHolderAddress(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(minterRole).setHolderAddress(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(registry.connect(sbtRole).setHolderAddress(randomAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
        await expect(
            registry.connect(marketplaceRole).setHolderAddress(randomAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if not owner try set oracle params', async () => {
        await expect(
            registry.connect(anyone).setOracleParams('1111', ethers.constants.HashZero, '10000000')
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry
                .connect(minterRole)
                .setOracleParams('1111', ethers.constants.HashZero, '10000000')
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry.connect(sbtRole).setOracleParams('1111', ethers.constants.HashZero, '10000000')
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
            registry
                .connect(marketplaceRole)
                .setOracleParams('1111', ethers.constants.HashZero, '10000000')
        ).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('Reverts if owner try set minter contract to zero address', async () => {
        await expect(registry.connect(owner).setMinterContract(AddressZero)).to.be.revertedWith(
            'Registry: Zero address'
        )
    })
    it('Reverts if owner try set marketplace contract to zero address', async () => {
        await expect(
            registry.connect(owner).setMarketplaceContract(AddressZero)
        ).to.be.revertedWith('Registry: Zero address')
    })
    it('Reverts if owner try set random contract to zero address', async () => {
        await expect(registry.connect(owner).setRandomContract(AddressZero)).to.be.revertedWith(
            'Registry: Zero address'
        )
    })
    it('Reverts if owner try set soulbounds contract to zero address', async () => {
        await expect(registry.connect(owner).setSoulboundsContract(AddressZero)).to.be.revertedWith(
            'Registry: Zero address'
        )
    })
    it('Reverts if owner try set holder contract to zero address', async () => {
        await expect(registry.connect(owner).setHolderAddress(AddressZero)).to.be.revertedWith(
            'Registry: Zero address'
        )
    })
    it('Reverts if owner try set minter address the same', async () => {
        await expect(registry.connect(owner).setMinterContract(minter.address)).to.be.revertedWith(
            'Registry: Setting the same value'
        )
    })
    it('Reverts if owner try set marketplace address the same', async () => {
        await expect(
            registry.connect(owner).setMarketplaceContract(marketplace.address)
        ).to.be.revertedWith('Registry: Setting the same value')
    })
    it('Reverts if owner try set random address the same', async () => {
        await expect(registry.connect(owner).setRandomContract(random.address)).to.be.revertedWith(
            'Registry: Setting the same value'
        )
    })
    it('Reverts if owner try set soulbounds address the same', async () => {
        await expect(
            registry.connect(owner).setSoulboundsContract(soulbounds.address)
        ).to.be.revertedWith('Registry: Setting the same value')
    })
    it('Reverts if owner try set holder address the same', async () => {
        await expect(registry.connect(owner).setHolderAddress(holder.address)).to.be.revertedWith(
            'Registry: Setting the same value'
        )
    })
})
